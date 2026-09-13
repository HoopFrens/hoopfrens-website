import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import opentype from "opentype.js";
import sharp, { type OverlayOptions } from "sharp";
import { renderPolicy } from "@/domain/content-intelligence/rendering";
import type { Storyboard, StorySlide } from "@/domain/content-intelligence/storyboard";
import { requireCondition } from "@/domain/content-intelligence/types";
import { sha256 } from "./media";

let fontPromise: Promise<{ heading: opentype.Font; body: opentype.Font; hashes: string[] }> | undefined;
export function fonts() {
  return fontPromise ||= Promise.all(["BarlowCondensed-Bold.ttf", "Barlow-Regular.ttf"].map(f => readFile(path.join(process.cwd(), "server/instagram-render/fonts", f))))
    .then(([h, b]) => ({ heading: opentype.parse(h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength)), body: opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), hashes: [sha256(h), sha256(b)] }));
}
function lines(text: string, font: opentype.Font, size: number, width: number): string[] {
  for (const c of text) requireCondition(/\s/.test(c) || font.charToGlyphIndex(c) !== 0, "render-glyph-unsupported");
  const result: string[] = [];
  for (const paragraph of text.trim().split(/\n+/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      requireCondition(font.getAdvanceWidth(word, size) <= width, "render-text-does-not-fit");
      const trial = current ? `${current} ${word}` : word;
      if (font.getAdvanceWidth(trial, size) <= width) current = trial;
      else { result.push(current); current = word; }
    }
    if (current) result.push(current);
  }
  return result;
}
export function textPaths(text: string, font: opentype.Font, box: { x: number; y: number; width: number; height: number }, maxSize: number, minSize: number, color: string) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    let wrapped: string[];
    try { wrapped = lines(text, font, size, box.width); } catch (error) { if ((error as Error).message === "render-glyph-unsupported") throw error; continue; }
    const step = size * 1.15;
    if (wrapped.length * step > box.height) continue;
    const paths = wrapped.map((line, i) => {
      const p = font.getPath(line, box.x, box.y + size + step * i, size); const b = p.getBoundingBox();
      requireCondition(b.x1 >= box.x - 2 && b.x2 <= box.x + box.width + 2 && b.y2 <= box.y + box.height + 2, "render-text-does-not-fit");
      p.fill = color; return p.toSVG(2);
    });
    return { svg: paths.join(""), size, lines: wrapped.length };
  }
  throw new Error("render-text-does-not-fit");
}
export function cropRect(width: number, height: number, targetWidth: number, targetHeight: number, x: number, y: number) {
  const ratio = targetWidth / targetHeight;
  const w = Math.min(width, Math.floor(height * ratio)); const h = Math.min(height, Math.floor(width / ratio));
  return { left: Math.round((width - w) * x / 100), top: Math.round((height - h) * y / 100), width: w, height: h };
}
export async function renderSlide(board: Storyboard, index: number, photo?: Buffer) {
  const slide: StorySlide = board.slides[index]; const f = await fonts();
  const W = renderPolicy.width, H = renderPolicy.height, dark = "#141414", cream = "#f3efe6", red = "#d5232c";
  const isPhoto = slide.layout === "photo";
  requireCondition(!isPhoto || photo, "render-photo-missing");
  const cover = slide.role === "cover";
  const photoHeight = cover ? 710 : 620;
  const takeaway = !isPhoto && slide.role === "takeaway";
  const headingY = isPhoto ? 104 + photoHeight + 32 : takeaway ? 220 : 350;
  const headingHeight = isPhoto ? (cover ? 264 : 230) : takeaway ? 230 : 365;
  const headline = textPaths(slide.headline.toUpperCase(), f.heading, { x: 54, y: headingY, width: 972, height: headingHeight }, cover ? 104 : 94, 64, isPhoto ? dark : cream);
  const bodyY = headingY + headline.lines * headline.size * 1.15 + 22;
  const paragraphs = takeaway ? slide.body.split(/\n+/).map(p => p.trim()).filter(Boolean) : [];
  let body = textPaths(slide.body, f.body, { x: 54, y: bodyY, width: 972, height: (takeaway ? 1080 : 1240) - bodyY }, 38, 32, isPhoto ? dark : cream);
  if (paragraphs.length > 1 && paragraphs.length <= 4) {
    const start = Math.max(bodyY + 30, 490); const step = Math.floor((1090 - start) / paragraphs.length);
    const rowBodies = paragraphs.map((p, i) => textPaths(p, f.body, { x: 160, y: start + i * step, width: 866, height: step - 28 }, 42, 36, cream));
    const rows = paragraphs.map((_p, i) => textPaths(String(i + 1).padStart(2, "0"), f.heading, { x: 54, y: start + i * step, width: 84, height: 80 }, 54, 48, red).svg
      + rowBodies[i].svg
      + `<rect x="160" y="${start + (i + 1) * step - 14}" width="866" height="1" fill="${cream}" opacity=".25"/>`);
    body = { svg: rows.join(""), size: Math.min(...rowBodies.map(r => r.size)), lines: rowBodies.reduce((total, r) => total + r.lines, 0) };
  }
  const callToAction = takeaway ? `<rect x="54" y="1145" width="972" height="88" fill="${red}"/>` + textPaths(board.brief.action.toUpperCase(), f.heading, { x: 78, y: 1162, width: 924, height: 58 }, 40, 36, cream).svg : "";
  const series = board.brief.type === "journey" ? "ATHLETE JOURNEYS" : board.binding.team === "Football" ? "FIELD NOTES" : "COURT NOTES";
  const mark = textPaths("HOOP FRENS", f.heading, { x: 54, y: 21, width: 440, height: 60 }, 44, 44, cream).svg;
  const seriesMark = textPaths(series, f.body, { x: 630, y: 35, width: 396, height: 40 }, 24, 24, cream).svg;
  const asset = isPhoto ? board.assets.find(a => a.id === slide.assetId) : undefined;
  const credit = textPaths(asset ? `Photo: ${asset.credit}` : board.binding.team === "Football" ? "Football. Every level." : "Basketball. Every level.", f.body, { x: 54, y: 1290, width: 845, height: 40 }, 22, 18, isPhoto ? dark : cream).svg;
  const count = textPaths(`${String(index + 1).padStart(2, "0")} / ${String(board.slides.length).padStart(2, "0")}`, f.heading, { x: 926, y: 1283, width: 110, height: 50 }, 30, 26, isPhoto ? dark : cream).svg;
  let photoLayer: OverlayOptions[] = []; let upscaled = false;
  if (photo) {
    const meta = await sharp(photo).metadata();
    const crop = cropRect(meta.width!, meta.height!, W, photoHeight, slide.focalX, slide.focalY);
    upscaled = crop.width < W || crop.height < photoHeight;
    const resized = await sharp(photo).extract(crop).resize(W, photoHeight, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
    photoLayer = [{ input: resized, left: 0, top: 104 }];
  }
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="1080" height="96" fill="${dark}"/><rect y="96" width="1080" height="8" fill="${red}"/>${mark}${seriesMark}${!isPhoto ? `<path d="M-80 1190 L560 210 M620 1470 L1260 490" stroke="${red}" stroke-width="2" opacity=".35"/>` : ""}${headline.svg}${body.svg}${callToAction}<rect x="54" y="1265" width="972" height="2" fill="${isPhoto ? dark : cream}" opacity=".25"/>${credit}${count}</svg>`;
  const bytes = await sharp({ create: { width: W, height: H, channels: 3, background: isPhoto ? cream : dark } }).composite([...photoLayer, { input: Buffer.from(overlay), left: 0, top: 0 }]).png().toBuffer();
  return { bytes, upscaled, typography: { headline: headline.size, body: body.size }, fontHashes: f.hashes };
}

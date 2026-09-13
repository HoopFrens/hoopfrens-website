import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { approvedUrl } from "@/domain/content-intelligence/policy";
import { requireCondition } from "@/domain/content-intelligence/types";
import { renderPolicy } from "@/domain/content-intelligence/rendering";
import { publicAddress } from "@/server/content-intelligence/sources";

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export async function decodePhoto(bytes: Buffer) {
  requireCondition(bytes.length > 0 && bytes.length <= renderPolicy.maxImageBytes, "render-image-rejected");
  try {
    const metadata = await sharp(bytes, { limitInputPixels: renderPolicy.maxPixels, failOn: "warning" }).metadata();
    requireCondition(["jpeg", "png", "webp"].includes(metadata.format || "") && (metadata.pages || 1) === 1 && metadata.width && metadata.height, "render-image-rejected");
    // Decode and strip metadata. Originals remain separately preserved and hashed; there is no generative alteration.
    const normalized = await sharp(bytes, { limitInputPixels: renderPolicy.maxPixels, failOn: "warning" }).rotate().toColourspace("srgb").png().timeout({ seconds: 10 }).toBuffer({ resolveWithObject: true });
    requireCondition(normalized.data.length <= 40_000_000, "render-image-rejected");
    return { originalHash: sha256(bytes), normalizedHash: sha256(normalized.data), image: normalized.data, width: normalized.info.width, height: normalized.info.height };
  } catch { throw new Error("render-image-rejected"); }
}
export function approvedPhotoRedirect(raw: string, domains: string[], original: URL) {
  try { return approvedUrl(raw, domains); } catch { /* Inspect the exact, observed school-specific delivery mapping below. */ }
  requireCondition(original.hostname === "malonepioneers.com" && original.pathname.startsWith("/images/") && !original.search, "render-image-unavailable");
  const url = new URL(raw);
  requireCondition(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash, "render-image-unavailable");
  const delivered = `https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/malonepioneers.com${original.pathname}`;
  const exactFile = url.href === delivered;
  const exactConversion = url.hostname === "images.sidearmdev.com" && url.pathname === "/convert"
    && [...url.searchParams.keys()].sort().join() === "type,url" && url.searchParams.get("type") === "webp" && url.searchParams.get("url") === delivered;
  requireCondition(exactFile || exactConversion, "render-image-unavailable"); return url;
}
export async function fetchPhoto(raw: string, domains: string[], signal: AbortSignal, redirects = 0, original?: URL): Promise<{ bytes: Buffer; resolvedUrl: string }> {
  requireCondition(redirects <= 3, "render-image-unavailable");
  const url = original ? approvedPhotoRedirect(raw, domains, original) : approvedUrl(raw, domains);
  signal.throwIfAborted();
  const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
    const stop = () => reject(new Error("render-image-unavailable"));
    signal.addEventListener("abort", stop, { once: true });
    lookup(url.hostname, { all: true, family: 4 }).then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
  signal.throwIfAborted();
  requireCondition(addresses.length > 0 && addresses.every(a => publicAddress(a.address)), "render-image-unavailable");
  const response = await new Promise<{ status: number; location?: string; bytes: Buffer; contentType: string }>((resolve, reject) => {
    const req = request(url, { signal, family: 4, lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4), headers: { "User-Agent": "HoopFrensStillRenderer/1.0", Accept: "image/jpeg,image/png,image/webp", "Accept-Encoding": "identity" } }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", chunk => { size += chunk.length; if (size > renderPolicy.maxImageBytes) { req.destroy(new Error("render-image-rejected")); return; } chunks.push(Buffer.from(chunk)); });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode || 0, location: res.headers.location, bytes: Buffer.concat(chunks), contentType: res.headers["content-type"] || "" }));
    });
    req.on("error", reject); req.end();
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    requireCondition(response.location, "render-image-unavailable");
    return fetchPhoto(new URL(response.location, url).href, domains, signal, redirects + 1, original || url);
  }
  requireCondition(response.status === 200 && /^image\/(jpeg|png|webp)(;|$)/i.test(response.contentType), "render-image-unavailable");
  return { bytes: response.bytes, resolvedUrl: url.href };
}

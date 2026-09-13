import "server-only";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { approvedSchool, approvedUrl } from "@/domain/content-intelligence/policy";
import type { SourcePolicy } from "@/domain/content-intelligence/types";
import type { PhotoCandidate, PhotoCategory, PhotoSearch } from "@/domain/content-intelligence/photos";
import { fetchApprovedPage } from "./sources";

export const photoSearchPolicy = { maxPages: 8, maxPhotos: 36, timeoutMs: 45_000, cacheMs: 15 * 60_000 } as const;
const categoryRules: [PhotoCategory, RegExp][] = [["Weight rooms", /weight[ _-]?room|strength|conditioning|fitness/], ["Locker rooms", /locker|changing[ _-]?room/], ["Courts", /basketball|court|arena|gymnasium|osborne|gym[ _.-]/], ["Fields", /football|stadium|field|turf/], ["Campus", /campus|quad|dorm|residence|student[ _-]?center|aerial|library/], ["Game action", /game[ _-]?action|gameday|tipoff|touchdown|dunk|layup/]];
const compact = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
function canonicalImage(raw: string, base: string, domains: string[]): string | null {
  try {
    let url = new URL(raw, base);
    // Normalize only the already-reviewed Malone transport mapping to its official school URL.
    if (url.hostname === "images.sidearmdev.com" && url.pathname === "/convert") {
      const nested = new URL(url.searchParams.get("url") || "");
      const prefix = "/sidearm.nextgen.sites/malonepioneers.com/";
      if (nested.protocol === "https:" && nested.hostname === "dxbhsrqyrr690.cloudfront.net" && nested.pathname.startsWith(prefix) && !nested.username && !nested.password && !nested.port) url = new URL(nested.pathname.slice(prefix.length), "https://malonepioneers.com/");
    }
    url = approvedUrl(url.href, domains);
    if (!/\.(png|jpe?g|webp)$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
export function extractPhotoCandidates(html: string, pageUrl: string, domains: string[]): { photos: PhotoCandidate[]; links: string[] } {
  const $ = load(html); const photos: PhotoCandidate[] = []; const seen = new Set<string>(); const links: string[] = [];
  const title = compact($("title").first().text(), 180);
  $("img").each((_i, element) => {
    const img = $(element);
    if (img.closest("nav,header,footer").length) return;
    const variants = (img.attr("srcset") || img.attr("data-srcset") || "").split(",").map(v => v.trim().split(/\s+/)).sort((a,b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0));
    const raw = [variants[0]?.[0], img.attr("data-src"), img.attr("data-original"), img.attr("src")].filter(Boolean) as string[];
    const imageUrl = raw.map(v => canonicalImage(v, pageUrl, domains)).find(Boolean); if (!imageUrl) return;
    const key = new URL(imageUrl).origin + new URL(imageUrl).pathname;
    const alt = compact(img.attr("alt") || "", 180);
    const filename = new URL(imageUrl).pathname.toLowerCase();
    if (/logo|sponsor|icon|badge|avatar|pixel|placeholder|loading/.test(`${alt.toLowerCase()} ${filename}`)) return;
    const width = Number(img.attr("width")) || undefined; const height = Number(img.attr("height")) || undefined;
    if (width && width < 400 || height && height < 250 || width && height && (width/height > 5 || width/height < 0.3)) return;
    if (seen.has(key)) return; seen.add(key);
    const caption = compact(img.closest("figure").find("figcaption").text(), 240);
    const context = compact([alt, caption, filename.split("/").at(-1)].filter(Boolean).join(" · "), 300);
    const category = categoryRules.find(([,pattern]) => pattern.test(context.toLowerCase()))?.[0] || "Other";
    const creditMatch = caption.match(/(?:photo(?:graph)?(?:s)? (?:by|credit)|credit)\s*:?\s*([^|.;]{2,85})/i);
    const credit = creditMatch ? compact(creditMatch[1],100) : `Source: ${new URL(pageUrl).hostname}`;
    photos.push({ category, context, ...(width ? {width} : {}), ...(height ? {height} : {}), asset: {
      id: `photo-${createHash("sha256").update(key).digest("hex").slice(0,24)}`, label: compact(alt || caption || `Photo from ${title || new URL(pageUrl).hostname}`,80), imageUrl, sourceUrl: pageUrl,
      credit, capturedOn: "", rights: "pending", permissionNote: ""
    } });
  });
  $("a[href]").each((_i, element) => {
    const href = $(element).attr("href") || "";
    const context = `${$(element).text()} ${href}`.toLowerCase();
    if (!/facilit|weight|strength|campus|virtual-tour|locker|stadium|arena|basketball|football/.test(context)) return;
    try { const url = approvedUrl(new URL(href,pageUrl).href, domains); if (/\.(pdf|zip|mp4|jpe?g|png|webp)$/i.test(url.pathname)) return; if (!links.includes(url.href)) links.push(url.href); } catch { /* Page links cannot expand the approved domains. */ }
  });
  links.sort((a,b) => Number(/facilit|weight|campus|locker|stadium|arena/.test(b)) - Number(/facilit|weight|campus|locker|stadium|arena/.test(a)));
  return {photos:photos.slice(0,photoSearchPolicy.maxPhotos),links:links.slice(0,12)};
}
export async function findSchoolPhotos(schoolId: string, evidenceUrls: string[], caller: AbortSignal, fetcher = fetchApprovedPage, sourcePolicy?: SourcePolicy): Promise<PhotoSearch> {
  const school = sourcePolicy || approvedSchool(schoolId); const signal = AbortSignal.any([caller,AbortSignal.timeout(photoSearchPolicy.timeoutMs)]);
  const domains = school.domains.slice(0,2);
  const roots = domains.map(d=>`https://${d}/`);
  const queue = [...new Set([...(school.priorityUrls || []),...roots,...evidenceUrls.filter(url=>{try{approvedUrl(url,domains);return true;}catch{return false;}})])];
  const seen = new Set<string>(); const images = new Map<string,PhotoCandidate>(); let unavailable=0;
  while (queue.length && seen.size < photoSearchPolicy.maxPages && !signal.aborted) {
    const next=queue.shift()!; if(seen.has(next))continue; seen.add(next);
    try {
      const result=await fetcher(next,domains,signal); const found=extractPhotoCandidates(result.text,result.url.href,domains);
      for(const photo of found.photos) { const key=new URL(photo.asset.imageUrl).origin+new URL(photo.asset.imageUrl).pathname; if(!images.has(key)&&images.size<144)images.set(key,photo); }
      for(const link of found.links)if(!seen.has(link)&&!queue.includes(link)&&queue.length<24)queue.splice(Math.min(2,queue.length),0,link);
    } catch { if(caller.aborted)throw new Error("photo-search-cancelled"); unavailable++; }
  }
  if(caller.aborted)throw new Error("photo-search-cancelled");
  const photos=[...images.values()].sort((a,b)=>Number(a.category==="Other")-Number(b.category==="Other")).slice(0,photoSearchPolicy.maxPhotos);
  return {photos,searchedPages:seen.size,foundAt:new Date().toISOString(),notes:["Categories are suggestions from page text. Check that each photo shows the right school and place.","A source credit is not a license. Usage rights are unknown unless separately documented.",...(unavailable?[`${unavailable} page(s) could not be read.`]:[]),...(signal.aborted?["Search time limit reached. Available results are shown."]:[])]};
}

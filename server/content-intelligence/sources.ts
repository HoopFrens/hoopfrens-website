import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { load } from "cheerio";
import { approvedUrl, policy } from "@/domain/content-intelligence/policy";
import { requireCondition } from "@/domain/content-intelligence/types";
import type { FetchedSource } from "@/domain/content-intelligence/ledger";

export function publicAddress(address: string) {
  // Only globally routable IPv4 is used; rejecting IPv6 also rejects mapped/encoded private forms.
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254
    || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b)
    || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19, 51].includes(b)
    || a === 203 && b === 0);
}
async function fetchPage(url: URL, domains: string[], signal: AbortSignal, redirects = 0): Promise<{ text: string; url: URL }> {
  requireCondition(redirects <= 3, "source-redirect-rejected");
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  signal.throwIfAborted();
  requireCondition(addresses.length > 0 && addresses.every(item => publicAddress(item.address)), "source-address-rejected");
  const response = await new Promise<{ status: number; location?: string; body: string; contentType: string }>((resolve, reject) => {
    const req = request(url, { signal, family: 4, headers: { "User-Agent": "HoopFrensResearch/1.0", Accept: "text/html,text/plain" },
      lookup: (_host, _options, callback) => callback(null, addresses[0].address, 4) }, res => {
      const chunks: Buffer[] = []; let bytes = 0;
      res.on("data", chunk => { bytes += chunk.length; if (bytes > policy.maxSourceBytes) { req.destroy(new Error("source-too-large")); return; } chunks.push(Buffer.from(chunk)); });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode || 0, location: res.headers.location, body: Buffer.concat(chunks).toString("utf8"), contentType: res.headers["content-type"] || "" }));
    });
    req.on("error", reject); req.end();
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    requireCondition(response.location, "source-redirect-rejected");
    return fetchPage(approvedUrl(new URL(response.location, url).href, domains), domains, signal, redirects + 1);
  }
  requireCondition(response.status === 200 && /^(text\/html|text\/plain)/i.test(response.contentType), "source-unavailable");
  return { text: response.body, url };
}
export async function fetchApprovedPage(url: string, domains: string[], signal: AbortSignal) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
  return Promise.race([
    fetchPage(approvedUrl(url, domains), domains, deadline),
    new Promise<never>((_, reject) => deadline.addEventListener("abort", () => reject(new Error("source-timeout")), { once: true })),
  ]);
}
export async function fetchSource(url: string, domains: string[], signal: AbortSignal, index: number): Promise<FetchedSource> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
  const result = await Promise.race([
    fetchPage(approvedUrl(url, domains), domains, deadline),
    new Promise<never>((_, reject) => deadline.addEventListener("abort", () => reject(new Error("source-timeout")), { once: true })),
  ]);
  const { title, text: normalized } = extractSourceText(result.text, result.url.hostname);
  return { id: `source-${index + 1}`, url: result.url.href, title, accessedAt: new Date().toISOString(),
    contentHash: createHash("sha256").update(normalized).digest("hex"), text: normalized };
}

export function extractSourceText(html: string, hostname: string) {
  const $ = load(html);
  const title = $("title").first().text().replace(/\s+/g, " ").trim().slice(0, 180) || hostname;
  // ASP.NET athletics sites wrap public articles in a form. Remove controls, not their content container.
  $("script,style,noscript,nav,footer,header,input,button,textarea,select,svg").remove();
  const text = $("main").length ? $("main").text() : $("body").text();
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, policy.maxSourceText);
  requireCondition(normalized.length >= 100, "source-unavailable");
  return { title, text: normalized };
}

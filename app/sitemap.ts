import { divisions } from "@/data/divisions";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hoopfrens.com";
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/submit`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...divisions.map(({ slug }) => ({ url: `${siteUrl}/${slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
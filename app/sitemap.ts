import { divisions } from "@/data/divisions";
import { resources } from "@/data/resources";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hoopfrens.com";
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/submit`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/recruiting-resources`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...divisions.map(({ slug }) => ({ url: `${siteUrl}/${slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...resources.map(({ slug }) => ({ url: `${siteUrl}/recruiting-resources/${slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}

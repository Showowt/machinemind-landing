import type { MetadataRoute } from "next";
import { projects } from "@/lib/projects-data";
import { SITE_ORIGIN, WEB_GRATIS_PATH } from "@/lib/web-gratis/config";

/**
 * /sitemap.xml — generated from the same data the pages render from, so a
 * project added to projects-data.ts is submitted to search without a second
 * edit here. Transactional and operator routes are deliberately absent; they
 * are also disallowed in robots.ts. /espanol is absent too — its own layout
 * sets robots:noindex, and listing a noindexed URL only spends crawl budget.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: WEB_GRATIS_PATH, priority: 0.9, changeFrequency: "weekly" },
    { path: "/viceroy", priority: 0.7, changeFrequency: "monthly" },
    // /viceroy/assess is intentionally NOT submitted: its POST writes to a
    // `viceroy_leads` table that was never created in prod and the insert error
    // is swallowed, so every submission is lost. Add it here once that table
    // exists and a test submission reads back.
    { path: "/voxlink", priority: 0.6, changeFrequency: "monthly" },
    { path: "/verificar", priority: 0.4, changeFrequency: "yearly" },
  ];

  const projectRoutes = projects
    .filter((project) => project.isActive)
    .map((project) => ({
      url: `${SITE_ORIGIN}/projects/${project.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: project.isFeatured ? 0.7 : 0.5,
    }));

  return [
    ...staticRoutes.map(({ path, priority, changeFrequency }) => ({
      url: `${SITE_ORIGIN}${path}`,
      lastModified,
      changeFrequency,
      priority,
    })),
    ...projectRoutes,
  ];
}

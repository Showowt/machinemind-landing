import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/web-gratis/config";

/**
 * /robots.txt — the site served a 404 here until 2026-10-18, which left crawlers
 * (and AI answer engines, which read robots before anything else) with no
 * sitemap pointer and no guidance about the transactional routes.
 *
 * Preview deployments return a blanket disallow: every preview serves the same
 * copy as production, and an indexed *.vercel.app preview competes with the
 * canonical domain for it.
 */
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";

  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", // operator consoles
          "/api/",
          "/activate", // per-client activation + payment
          "/pagar/", // per-client payment links
          "/s/", // short links (redirects, no content)
          "/q/", // QR resolver (redirects, no content)
          "/citas/", // booking redirects
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}

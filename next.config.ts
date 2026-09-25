import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  // BS-09: Three.js and GSAP require server-side exclusion
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "three"];
    }
    return config;
  },
  // Free-website funnel aliases → /web. Redirect sources match case-insensitively,
  // so "/gratis" also covers "/Gratis" and "/GRATIS". Never list a case variant of
  // "/web" itself here — it would match "/web" and loop. Country entry links
  // (/colombia, /elsalvador) pick the market; the visitor's own query string
  // (utm_*, fbclid, ref) is carried over to /web by Next.js.
  async redirects() {
    const aliases = ["/gratis", "/web-gratis", "/webgratis"].map((source) => ({
      source,
      destination: "/web",
      permanent: false,
    }));
    const markets = [
      { source: "/colombia", destination: "/web?pais=co", permanent: false },
      { source: "/elsalvador", destination: "/web?pais=sv", permanent: false },
      { source: "/el-salvador", destination: "/web?pais=sv", permanent: false },
    ];
    return [...aliases, ...markets];
  },
  // Page routes ARE case-sensitive, so a phone-capitalized "/Web" would 404.
  // This (case-insensitive) rewrite only runs after no page matched, so "/web"
  // itself is untouched while "/Web" and "/WEB" serve the same page.
  async rewrites() {
    return [{ source: "/web", destination: "/web" }];
  },
  // CORS headers for API routes
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

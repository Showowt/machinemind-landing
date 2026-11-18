import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/products-data";

// Per-route SEO + social metadata derived from the product record.
// The sibling opengraph-image.tsx supplies the preview image automatically.
export function productMetadata(slug: string): Metadata {
  const p = getProductBySlug(slug);
  if (!p) return {};
  const url = `/${slug}`;
  return {
    title: p.seo.title,
    description: p.seo.description,
    alternates: { canonical: url },
    openGraph: {
      title: p.seo.title,
      description: p.seo.description,
      url,
      type: "website",
      siteName: "MachineMind",
    },
    twitter: {
      card: "summary_large_image",
      title: p.seo.title,
      description: p.seo.description,
    },
  };
}

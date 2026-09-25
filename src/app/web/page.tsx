import type { Metadata } from "next";
import { headers } from "next/headers";
import WebGratisClient from "./WebGratisClient";
import { FREE_DAYS, MONTHLY_PRICE_USD, parseMarket, type Market } from "@/lib/web-gratis/config";

// Neutral two-country framing: MachineMind's own initiative, no government claims.
const TITLE = "Su página web, gratis — Iniciativa de Digitalización de Negocios 2026 · MachineMind";
const SOCIAL_TITLE = "Su página web, gratis — Iniciativa de Digitalización 2026 · El Salvador y Colombia";
const DESCRIPTION = `Iniciativa de Digitalización de Negocios 2026 en El Salvador y Colombia: le hacemos la página web de su negocio gratis. ${FREE_DAYS} días gratis en línea y después $${MONTHLY_PRICE_USD} USD al mes, sin contrato. MachineMind, empresa privada.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/web" },
  openGraph: {
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    url: "/web",
    type: "website",
    locale: "es_LA",
    siteName: "MachineMind",
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
  },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The market is known on the server when the link carries ?pais= / ?country=
 * (e.g. /colombia → /web?pais=co), so the hero renders the right country with
 * no flash. Otherwise the visitor's IP country is only a hint; the client
 * still prefers their saved choice and their browser time zone.
 */
export default async function WebGratisPage({ searchParams }: PageProps) {
  // No try/catch around searchParams/headers(): they signal dynamic rendering by throwing
  // during prerender, and catching that makes Next treat the page as static. parseMarket
  // never throws (unknown values → null).
  const params = await searchParams;
  const initialMarket: Market | null = parseMarket(first(params.pais) ?? first(params.country));
  const marketHint: Market | null = initialMarket ? null : parseMarket((await headers()).get("x-vercel-ip-country"));
  return <WebGratisClient initialMarket={initialMarket} marketHint={marketHint} />;
}

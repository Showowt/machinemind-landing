import type { Metadata } from "next";
import { headers } from "next/headers";
import { z } from "zod";
import QuickClient from "./QuickClient";
import WebGratisClient from "./WebGratisClient";
import { FREE_DAYS, isOpenMarket, MONTHLY_PRICE_USD, OPEN_MARKETS, parseMarket, type Market } from "@/lib/web-gratis/config";

// El Salvador + Panamá (Phil 2026-09-30). MachineMind's own initiative, no government claims.
const TITLE = "Su página web, gratis — Iniciativa de Digitalización de Negocios 2026 · MachineMind";
const SOCIAL_TITLE = "Su página web, gratis — Iniciativa de Digitalización 2026 · El Salvador y Panamá";
const DESCRIPTION = `Iniciativa de Digitalización de Negocios 2026 en El Salvador y Panamá: le hacemos la página web de su negocio gratis. Deje su número de WhatsApp y lo llamamos. ${FREE_DAYS} días gratis en línea y después usted decide: la seguimos alojando por $${MONTHLY_PRICE_USD} USD al mes con soporte completo, o la aloja usted mismo. Sin contrato. MachineMind, empresa privada.`;

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
 * Default: the number-only quick capture (Phil's pivot, 2026-09-30) — the ads
 * land here and Fernanda calls every number. The full 3-step form stays for
 * the team and the chat flows at ?form=full, and ?draft=<uuid> makes it
 * complete THAT row (a quick capture) instead of opening a new one.
 */
export default async function WebGratisPage({ searchParams }: PageProps) {
  // No try/catch around searchParams/headers(): they signal dynamic rendering by throwing
  // during prerender, and catching that makes Next treat the page as static. parseMarket
  // never throws (unknown values → null).
  const params = await searchParams;
  const asked = parseMarket(first(params.pais) ?? first(params.country));
  const onlyOpen: Market | null = OPEN_MARKETS.length === 1 ? OPEN_MARKETS[0] : null;
  const initialMarket: Market | null = isOpenMarket(asked) ? asked : onlyOpen;
  const marketHint: Market | null = initialMarket ? null : parseMarket((await headers()).get("x-vercel-ip-country"));

  const draftParam = first(params.draft);
  const adoptDraftId = draftParam && z.uuid().safeParse(draftParam).success ? draftParam : null;
  const fullForm = first(params.form) === "full" || !!adoptDraftId;

  if (fullForm) {
    return <WebGratisClient initialMarket={initialMarket} marketHint={marketHint} adoptDraftId={adoptDraftId} />;
  }
  return <QuickClient initialMarket={initialMarket} marketHint={marketHint} />;
}

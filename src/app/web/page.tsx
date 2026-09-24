import type { Metadata } from "next";
import WebGratisClient from "./WebGratisClient";

const TITLE = "Su página web, gratis — MachineMind El Salvador";
const DESCRIPTION =
  "Le armamos la página web de su negocio gratis. Lista en pocos días, 30 días gratis en línea y después $19 al mes, sin contrato.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/web" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/web",
    type: "website",
    locale: "es_SV",
    siteName: "MachineMind",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function WebGratisPage() {
  return <WebGratisClient />;
}

import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";

// Cinema Engine CSS
import "@/styles/cinema-engine.css";

// Only Space Mono from Google - Clash Display, Satoshi, Instrument Serif loaded via CSS @import
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://machinemindconsulting.com"),
  title: "MachineMind | Sistemas Autopoiéticos para Negocios Inteligentes",
  description:
    "Automatización con IA que se mantiene sola. 31 proyectos activos, 15 clientes en producción, +50K conversaciones de IA. Transformamos la hospitalidad latinoamericana.",
  keywords: [
    "AI automation",
    "automatización IA",
    "hospitality tech",
    "tecnología hospitalidad",
    "Cartagena",
    "Colombia",
    "WhatsApp business",
    "concierge AI",
    "booking automation",
  ],
  authors: [{ name: "MachineMind" }],
  creator: "MachineMind",
  openGraph: {
    title: "MachineMind | Autopoietic Systems",
    description: "Self-sustaining AI automation for Latin American hospitality",
    type: "website",
    locale: "es_CO",
    alternateLocale: "en_US",
    siteName: "MachineMind",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MachineMind - Autopoietic Portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MachineMind | Autopoietic Systems",
    description: "Self-sustaining AI automation for hospitality",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={spaceMono.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="theme-color" content="#06060a" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

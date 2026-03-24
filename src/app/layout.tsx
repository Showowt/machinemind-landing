import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://machinemindconsulting.com"),
  title: "MachineMind | AI Automation Consultancy",
  description:
    "We build AI systems that think. Automation infrastructure for hospitality, real estate, and private capital. 47+ deployments. 24/7 active.",
  keywords: [
    "AI automation",
    "automation consultancy",
    "hospitality tech",
    "WhatsApp AI",
    "Sofia AI",
    "Cinema Engine",
    "Cartagena",
    "Colombia",
  ],
  authors: [{ name: "MachineMind" }],
  creator: "MachineMind",
  openGraph: {
    title: "MachineMind | AI Automation Consultancy",
    description: "We build AI systems that think.",
    type: "website",
    locale: "en_US",
    siteName: "MachineMind",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MachineMind - AI Automation Consultancy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MachineMind | AI Automation Consultancy",
    description: "We build AI systems that think.",
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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="theme-color" content="#06060a" />
      </head>
      <body className="antialiased">
        {children}

        {/* Film Grain Overlay */}
        <svg className="film-grain" aria-hidden="true">
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        {/* Vignette Overlay */}
        <div className="vignette" aria-hidden="true" />
      </body>
    </html>
  );
}

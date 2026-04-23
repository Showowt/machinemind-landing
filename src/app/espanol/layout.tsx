import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Español OS — Fluency Engine",
  description: "Real conversations. Real corrections. Real fluency. Elite Spanish acquisition system built for Cartagena.",
  robots: { index: false, follow: false },
  applicationName: "Español OS",
  appleWebApp: {
    capable: true,
    title: "Español OS",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Español OS",
    description: "Real conversations. Real corrections. Real fluency.",
    siteName: "Español OS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Español OS",
    description: "Real conversations. Real corrections. Real fluency.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F0E0C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function EspanolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#0F0E0C", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}

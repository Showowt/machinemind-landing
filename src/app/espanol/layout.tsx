import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ESPAÑOL OS — Fluency Engine",
  description: "Elite Spanish acquisition system. Real conversations, real-time corrections, real fluency.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function EspanolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#050505", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}

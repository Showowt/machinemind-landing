import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viceroy — Private Capital Intelligence | MachineMind",
  description:
    "Viceroy is MachineMind's private capital engine: investor psychology modelling, 8-axis alignment scoring, and deal intelligence for off-market opportunities.",
  alternates: { canonical: "/viceroy" },
  openGraph: {
    title: "Viceroy — Private Capital Intelligence",
    description:
      "Investor psychology modelling, 8-axis alignment scoring, and deal intelligence for off-market opportunities.",
    url: "/viceroy",
    type: "website",
    siteName: "MachineMind",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viceroy — Private Capital Intelligence",
    description:
      "Investor psychology modelling, 8-axis alignment scoring, and deal intelligence.",
  },
};

export default function ViceroyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

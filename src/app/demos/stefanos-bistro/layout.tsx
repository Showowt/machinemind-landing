import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Steffano's Bistro | Italian & French Cuisine | Cartagena",
  description:
    "Authentic Italian and French cuisine in the heart of Cartagena. 40+ years of culinary excellence. Reservations via WhatsApp.",
  keywords: [
    "Steffano's Bistro",
    "Italian restaurant Cartagena",
    "French cuisine Colombia",
    "fine dining Cartagena",
    "best restaurant Cartagena",
  ],
  openGraph: {
    title: "Steffano's Bistro | Cartagena",
    description: "Italian & French cuisine with 40+ years of culinary excellence.",
    type: "website",
    locale: "es_CO",
  },
};

export default function StefanosBistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

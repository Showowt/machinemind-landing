import { buildProductOg } from "@/lib/product-og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Puente · Cross-Border Real Estate Intelligence — MachineMind";

export default function Image() {
  return buildProductOg("puente");
}

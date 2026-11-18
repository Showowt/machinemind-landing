import { buildProductOg } from "@/lib/product-og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "IA para el Estado · Public-Sector AI — MachineMind";

export default function Image() {
  return buildProductOg("estado");
}

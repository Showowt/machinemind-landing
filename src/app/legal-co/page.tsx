import ProductPage from "@/components/products/ProductPage";
import { productMetadata } from "@/lib/product-meta";

export const metadata = productMetadata("legal-co");

export default function Page() {
  return <ProductPage slug="legal-co" />;
}

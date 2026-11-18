import ProductPage from "@/components/products/ProductPage";
import { productMetadata } from "@/lib/product-meta";

export const metadata = productMetadata("legal-sv");

export default function Page() {
  return <ProductPage slug="legal-sv" />;
}

import ProductPage from "@/components/products/ProductPage";
import { productMetadata } from "@/lib/product-meta";

export const metadata = productMetadata("puente");

export default function Page() {
  return <ProductPage slug="puente" />;
}

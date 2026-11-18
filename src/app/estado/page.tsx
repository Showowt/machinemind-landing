import ProductPage from "@/components/products/ProductPage";
import { productMetadata } from "@/lib/product-meta";

export const metadata = productMetadata("estado");

export default function Page() {
  return <ProductPage slug="estado" />;
}

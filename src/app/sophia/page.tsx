import ProductPage from "@/components/products/ProductPage";
import { productMetadata } from "@/lib/product-meta";

export const metadata = productMetadata("sophia");

export default function Page() {
  return <ProductPage slug="sophia" />;
}

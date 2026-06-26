import { ProductHero } from "@/components/ProductHero";
import { ProductStats } from "@/components/ProductStats";
import { ProductFeature } from "@/components/ProductFeature";
import { ProductCards } from "@/components/ProductCards";

export default function ProductPage() {
  return (
    <>
      <ProductHero />
      <ProductStats />
      <ProductFeature />
      <ProductCards />
    </>
  );
}

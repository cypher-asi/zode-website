import { ProductHero } from "@/components/ProductHero";
import { ProductStats } from "@/components/ProductStats";
import { ProductExplorer } from "@/components/ProductExplorer";
import { ProductFeature } from "@/components/ProductFeature";
import { ProductCards } from "@/components/ProductCards";

export default function ProductPage() {
  return (
    <>
      <ProductHero />
      <ProductStats />
      <ProductExplorer />
      <ProductFeature />
      <ProductCards />
    </>
  );
}

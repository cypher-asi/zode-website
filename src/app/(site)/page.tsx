import type { CSSProperties } from "react";
import { ProductHero } from "@/components/ProductHero";
import { ProductStats } from "@/components/ProductStats";
import { ProductExplorer } from "@/components/ProductExplorer";
import { ProductFeature } from "@/components/ProductFeature";
import { ProductCards } from "@/components/ProductCards";
import { ProductSpecs } from "@/components/ProductSpecs";
import { ProductCTA } from "@/components/ProductCTA";

// Sun-toned accent, scoped to the product page only. `display: contents`
// keeps layout untouched while the overridden token cascades to children.
const productAccent = {
  "--color-accent": "#ffd6a0",
  display: "contents",
} as CSSProperties;

export default function ProductPage() {
  return (
    <div style={productAccent}>
      <ProductHero />
      <ProductStats />
      <ProductExplorer />
      <ProductFeature />
      <ProductCards />
      <ProductSpecs />
      <ProductCTA />
    </div>
  );
}

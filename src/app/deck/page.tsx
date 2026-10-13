import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PinnedHeader } from "@/components/layout/PinnedHeader";
import { Deck, DeckGround } from "@/features/deck/Deck";
import { SLIDES } from "@/features/deck/slides";
import { INVEST_ACTION } from "@/lib/navigation";

const DESCRIPTION =
  "ZODE's investor presentation: factory-made AI data centers, online in 90 days and sold on take-or-pay compute contracts.";

export const metadata: Metadata = {
  title: "Investor deck | ZODE",
  description: DESCRIPTION,
  openGraph: { title: "ZODE investor deck", description: DESCRIPTION },
  // Shared by link from Resources, but kept out of search.
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The investor deck, a resource linked from the footer and header menus.
 * Lives outside the `(site)` group, like /compute-model, so the slides fill
 * the viewport without the landscape footer. `?slide=N` (1-based) opens it on
 * a given slide, so shared links land where they were copied. The query is
 * only known per request, so the deck's ground and header paint first.
 */
export default function DeckPage({ searchParams }: { searchParams: SearchParams }) {
  const header = <PinnedHeader primary={INVEST_ACTION} />;
  return (
    <Suspense fallback={<DeckGround header={header} />}>
      <DeckAtSlide searchParams={searchParams} header={header} />
    </Suspense>
  );
}

async function DeckAtSlide({ searchParams, header }: { searchParams: SearchParams; header: ReactNode }) {
  const { slide } = await searchParams;
  const requested = typeof slide === "string" ? Number.parseInt(slide, 10) : 1;
  const initial = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), SLIDES.length) - 1 : 0;

  return <Deck initialSlide={initial} header={header} />;
}

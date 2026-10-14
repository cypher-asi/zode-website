import type { Metadata } from "next";
import { Suspense } from "react";
import { Deck, DeckGround } from "@/features/deck/Deck";
import { getPolicyMap } from "@/features/deck/policy";
import { SLIDES } from "@/features/deck/slides";

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
 * only known per request, so the deck's ground paints first.
 */
export default function DeckPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<DeckGround />}>
      <DeckAtSlide searchParams={searchParams} />
    </Suspense>
  );
}

/** The policy slide's map comes from the tracker tables; without them the slide says so and the rest of the deck stands. */
async function DeckAtSlide({ searchParams }: { searchParams: SearchParams }) {
  const [{ slide }, policy] = await Promise.all([
    searchParams,
    getPolicyMap().catch((error: unknown) => {
      console.error("[deck] policy tracker unavailable", error);
      return null;
    }),
  ]);
  const requested = typeof slide === "string" ? Number.parseInt(slide, 10) : 1;
  const initial = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), SLIDES.length) - 1 : 0;

  return <Deck initialSlide={initial} policy={policy} />;
}

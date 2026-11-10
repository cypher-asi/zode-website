import type { Metadata } from "next";
import { Suspense } from "react";
import { deckSlides } from "@/features/deck/access";
import { Deck, DeckGround } from "@/features/deck/Deck";
import { getPolicyMap } from "@/features/deck/policy";

const DESCRIPTION =
  "ZODE's investor presentation: factory-made AI data centers, online in 120 days and selling compute through offtake, merchant and token sales.";

export const metadata: Metadata = {
  title: "Investor deck | ZODE",
  description: DESCRIPTION,
  openGraph: { title: "ZODE investor deck", description: DESCRIPTION },
  // Shared by link from Resources, but kept out of search.
  robots: { index: false, follow: false },
  // A data room's share token can ride in the address (`?room=`); its outbound links mustn't pass it on.
  referrer: "no-referrer",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The investor deck, a resource linked from the footer and header menus.
 * Lives outside the `(site)` group, like /compute-model, so the slides fill
 * the viewport without the landscape footer. `?slide=N` (1-based) opens it on
 * a given slide, so shared links land where they were copied. Past project
 * finance it's for readers with data room access: members signed in, or
 * visitors from a room's share link, which opens it with `?room=<token>`.
 * Both are only known per request, so the deck's ground paints first.
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
  const { slide, room } = await searchParams;
  const [slides, policy] = await Promise.all([
    deckSlides(typeof room === "string" ? room : undefined),
    getPolicyMap().catch((error: unknown) => {
      console.error("[deck] policy tracker unavailable", error);
      return null;
    }),
  ]);
  const requested = typeof slide === "string" ? Number.parseInt(slide, 10) : 1;
  const initial = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), slides.length) - 1 : 0;

  return <Deck slides={slides} initialSlide={initial} policy={policy} />;
}

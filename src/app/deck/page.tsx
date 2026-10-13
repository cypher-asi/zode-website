import type { Metadata } from "next";
import { PinnedHeader } from "@/components/layout/PinnedHeader";
import { Deck } from "@/features/deck/Deck";
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

export const instant = false;

/**
 * The investor deck, a resource linked from the footer and header menus.
 * Lives outside the `(site)` group, like /compute-model, so the slides fill
 * the viewport without the landscape footer. `?slide=N` (1-based) opens it on
 * a given slide, so shared links land where they were copied.
 */
export default async function DeckPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slide } = await searchParams;
  const requested = typeof slide === "string" ? Number.parseInt(slide, 10) : 1;
  const initial = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), SLIDES.length) - 1 : 0;

  return <Deck initialSlide={initial} header={<PinnedHeader />} />;
}

import type { Metadata } from "next";
import { CompanyProfile } from "@/features/profile/CompanyProfile";

const DESCRIPTION =
  "ZODE's one-page company profile: factory-made AI data centers, the capacity pipeline, customers and leadership.";

export const metadata: Metadata = {
  title: "Company profile | ZODE",
  description: DESCRIPTION,
  openGraph: { title: "ZODE company profile", description: DESCRIPTION },
  // Shared as a PDF or by link, like the deck, but kept out of search.
  robots: { index: false, follow: false },
};

/**
 * The one-page company profile. Lives outside the `(site)` group, like
 * /deck, so the sheet prints without the site's footer; the pinned header is
 * hidden here (see headerRoutes.ts) because the sheet carries its own wordmark.
 */
export default function CompanyProfilePage() {
  return <CompanyProfile />;
}

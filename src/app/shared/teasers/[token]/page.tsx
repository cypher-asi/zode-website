import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SharedDocPage, sharedDocMetadata } from "@/features/deployments/SharedDoc";

export async function generateMetadata({ params }: PageProps<"/shared/teasers/[token]">): Promise<Metadata> {
  return sharedDocMetadata("teaser", (await params).token);
}

/** A deployment's teaser shared on its own. Outside `(site)`, like the deployment's public page. */
export default function SharedTeaserPage({ params }: PageProps<"/shared/teasers/[token]">): ReactElement {
  return <SharedDocPage doc="teaser" token={params.then((p) => p.token)} />;
}

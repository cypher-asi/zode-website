import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SharedDocPage, sharedDocMetadata } from "@/features/deployments/SharedDoc";

export async function generateMetadata({ params }: PageProps<"/shared/presentations/[token]">): Promise<Metadata> {
  return sharedDocMetadata("presentation", (await params).token);
}

/** A deployment's presentation shared on its own. Outside `(site)`, like the deployment's public page. */
export default function SharedPresentationPage({ params }: PageProps<"/shared/presentations/[token]">): ReactElement {
  return <SharedDocPage doc="presentation" token={params.then((p) => p.token)} />;
}

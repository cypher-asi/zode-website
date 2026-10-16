import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DeploymentsIndex } from "@/features/deployments/DeploymentsIndex";

export const metadata: Metadata = {
  title: "Completed deployments | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Completed GPU deployments, for every signed-in account. */
export default function CompletedDeploymentsPage(): ReactElement {
  return <DeploymentsIndex scope="completed" />;
}

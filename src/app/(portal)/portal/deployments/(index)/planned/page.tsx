import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DeploymentsIndex } from "@/features/deployments/DeploymentsIndex";

export const metadata: Metadata = {
  title: "Planned deployments | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Planned GPU deployments, for every signed-in account. */
export default function PlannedDeploymentsPage(): ReactElement {
  return <DeploymentsIndex scope="planned" />;
}

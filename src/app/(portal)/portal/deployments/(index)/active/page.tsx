import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DeploymentsIndex } from "@/features/deployments/DeploymentsIndex";

export const metadata: Metadata = {
  title: "Active deployments | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Active GPU deployments, for every signed-in account. */
export default function ActiveDeploymentsPage(): ReactElement {
  return <DeploymentsIndex scope="active" />;
}

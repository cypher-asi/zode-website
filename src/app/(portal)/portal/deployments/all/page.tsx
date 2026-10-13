import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DeploymentsIndex } from "@/features/deployments/DeploymentsIndex";

export const metadata: Metadata = {
  title: "All deployments | Deployments | ZODE",
  robots: { index: false, follow: false },
};

/** Every GPU deployment, whatever its status, for every signed-in account. */
export default function AllDeploymentsPage(): ReactElement {
  return <DeploymentsIndex scope="all" />;
}

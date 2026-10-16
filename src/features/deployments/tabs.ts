/** A deployment page's tabs, for the server page that picks one and the client switch that changes it. */
export type DeploymentTab = "summary" | "bom" | "quotes";

export const TABS: readonly { id: DeploymentTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "bom", label: "BOM" },
  { id: "quotes", label: "Quotes" },
];

export const isDeploymentTab = (value: unknown): value is DeploymentTab => TABS.some((tab) => tab.id === value);

export const tabHref = (base: string, tab: DeploymentTab): string => (tab === "summary" ? base : `${base}?tab=${tab}`);

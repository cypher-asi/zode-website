/** A deployment page's tabs, for the server page that picks one and the client switch that changes it. */
export type DeploymentTab = "summary" | "bom" | "quotes" | "presentation" | "teaser";

/** The header's switch. The presentation and teaser open from their own buttons, so they aren't listed. */
export const TABS: readonly { id: DeploymentTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "bom", label: "BOM" },
  { id: "quotes", label: "Quotes" },
];

export const isDeploymentTab = (value: unknown): value is DeploymentTab =>
  value === "presentation" || value === "teaser" || TABS.some((tab) => tab.id === value);

export const tabHref = (base: string, tab: DeploymentTab): string => (tab === "summary" ? base : `${base}?tab=${tab}`);

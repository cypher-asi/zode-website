import type { Deployment } from "@/features/deployments/types";
import type { SiteContent } from "../types";
import { CHICAGO_801_CANAL } from "./chicago801Canal";

/** Each site profile, with the addresses it's for. */
const SITES: readonly { address: RegExp; site: SiteContent }[] = [
  { address: /\b801\s+S(outh|\.)?\s+Canal\b/i, site: CHICAGO_801_CANAL },
];

/** The profile of the site `deployment` is at, if one's written for its address. */
export const siteOf = (deployment: Deployment): SiteContent | null =>
  (deployment.address && SITES.find(({ address }) => address.test(deployment.address!))?.site) || null;

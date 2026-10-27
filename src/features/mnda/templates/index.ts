import type { MndaTemplate } from "./types";
import { V1 } from "./v1";
import { V2 } from "./v2";

export type { AgreementSection, Blank, MndaTemplate } from "./types";

/**
 * Every version of the MNDA, oldest first. A version is frozen once anyone has
 * signed it, since executed copies were stamped from its PDF and record its
 * `version`. Changing the wording means adding vN.ts and assets/zode-mnda-vN.pdf
 * and making it current; agreements already signed stay on their version.
 */
export const MNDA_TEMPLATES: readonly MndaTemplate[] = [V1, V2];

/** The version new signers review and sign, whether from /mnda or a data room invite. */
export const CURRENT_TEMPLATE: MndaTemplate = V2;

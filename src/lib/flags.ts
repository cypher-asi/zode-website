/**
 * Feature flags for gating unfinished or not-yet-public surfaces.
 * Flip a flag and redeploy to toggle the corresponding surface.
 */

/**
 * Controls whether the "Invest" discovery link appears in the nav and footer.
 * The investor deck itself always lives publicly at `/deck`; this flag only
 * gates the marketing entry points to it. Flip to `true` to surface them.
 */
export const INVEST_ENABLED = false;

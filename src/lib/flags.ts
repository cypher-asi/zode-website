/**
 * Feature flags for gating unfinished or not-yet-public surfaces.
 * Flip a flag and redeploy to toggle the corresponding surface.
 */

/**
 * The `/invest` investor page is on hold for now. While `false`, the route
 * returns a 404 as if it doesn't exist. Flip to `true` to make it public.
 */
export const INVEST_ENABLED = false;

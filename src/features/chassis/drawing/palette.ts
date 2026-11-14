/*
 * The drawing set's paper and ink. Sheets are printed and exported to PDF as
 * they look on screen, white paper in either portal theme, so these are fixed
 * colours rather than the site's tokens.
 */

export const INK = "#111111";
export const PAPER_WHITE = "#ffffff";
export const FILL = { none: "none", white: PAPER_WHITE, light: "#f3f3f3", dark: "#e1e1e1", mid: "#cfcfcf" } as const;
export const HATCH = "#7a7a7a";

/** Selected and hovered elements, on the sheets and in the 3D views. */
export const SEL = "#2563eb";
export const SEL_FILL = "#dbeafe";
export const HOV = "#d97706";
export const HOV_FILL = "#fef3c7";

/** Outlines of 3D parts. */
export const EDGE = "#1f2937";

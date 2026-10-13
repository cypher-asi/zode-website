/** Holds the portal's theme, read by the portal layout so the first paint is already in it. */
export const PORTAL_THEME_COOKIE = "zode_portal_theme";

export type PortalTheme = "light" | "dark";

/** The theme a cookie value asks for, light unless it says dark. */
export function parsePortalTheme(value: string | undefined): PortalTheme {
  return value === "dark" ? "dark" : "light";
}

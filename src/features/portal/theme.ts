/**
 * Holds the portal's theme. Read in the browser, by PortalFrame and the inline
 * script it renders, so the server never has to and the first paint is already in it.
 */
export const PORTAL_THEME_COOKIE = "zode_portal_theme";

export type PortalTheme = "light" | "dark";

/** The theme a cookie value asks for, light unless it says dark. */
export function parsePortalTheme(value: string | undefined): PortalTheme {
  return value === "dark" ? "dark" : "light";
}

/** The theme a `document.cookie` string holds. */
export function readPortalTheme(cookieHeader: string): PortalTheme {
  const prefix = `${PORTAL_THEME_COOKIE}=`;
  return parsePortalTheme(
    cookieHeader
      .split("; ")
      .find((entry) => entry.startsWith(prefix))
      ?.slice(prefix.length),
  );
}

/**
 * Sets the dark theme on the script's parent before it paints, for an inline
 * script as the theme's element's first child; React takes over at hydration.
 */
export const PORTAL_THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${PORTAL_THEME_COOKIE}=([^;]*)/);if(m&&m[1]==="dark")document.currentScript.parentElement.dataset.theme="dark"}catch(e){}})()`;

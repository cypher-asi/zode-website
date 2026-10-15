/**
 * Holds whether the portal's rail is expanded to show its apps' names. Read
 * in the browser, by PortalFrame and the inline script it renders, so the
 * server never has to and the first paint is already in it.
 */
export const PORTAL_RAIL_COOKIE = "zode_portal_rail";

export type PortalRail = "collapsed" | "expanded";

/** The rail a `document.cookie` string holds, collapsed unless it says expanded. */
export function readPortalRail(cookieHeader: string): PortalRail {
  const prefix = `${PORTAL_RAIL_COOKIE}=`;
  const value = cookieHeader
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
  return value === "expanded" ? "expanded" : "collapsed";
}

/**
 * Expands the rail on the script's parent before it paints, for an inline
 * script as a child of the rail's element; React takes over at hydration.
 */
export const PORTAL_RAIL_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${PORTAL_RAIL_COOKIE}=([^;]*)/);if(m&&m[1]==="expanded")document.currentScript.parentElement.dataset.rail="expanded"}catch(e){}})()`;

import type { MouseEvent } from "react";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const XLINK = "http://www.w3.org/1999/xlink";

/** Web, mail and in-page links; anything else (`javascript:`, `data:`, `file:`) is refused. */
function isSafeHref(href: string): boolean {
  if (href.startsWith("#")) return true;
  try {
    return SAFE_PROTOCOLS.has(new URL(href, window.location.href).protocol);
  } catch {
    return false;
  }
}

const hrefOf = (el: Element): string | null => el.getAttribute("href") ?? el.getAttributeNS(XLINK, "href");

/**
 * Office documents are rendered into the page itself, and the site's CSP
 * allows inline script ('unsafe-inline'), so a `javascript:` hyperlink in a
 * file would run as the viewer on click. Strips unsafe links and elements
 * that load or submit anything, and sends the remaining links to a new tab
 * without a referrer.
 */
export function defuseLinks(root: HTMLElement): void {
  for (const el of root.querySelectorAll("script, iframe, frame, object, embed, form, base, meta, link")) el.remove();
  for (const el of root.querySelectorAll("[href], [*|href]")) {
    const href = hrefOf(el);
    if (href === null || !isSafeHref(href.trim())) {
      el.removeAttribute("href");
      el.removeAttributeNS(XLINK, "href");
    } else if (!href.startsWith("#")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }
}

/** Click guard for links added after `defuseLinks` ran, e.g. by lazy rendering. */
export function blockUnsafeLinks(event: MouseEvent): void {
  const link = (event.target as Element | null)?.closest?.("a, [href]");
  const href = link ? hrefOf(link) : null;
  if (href !== null && !isSafeHref(href.trim())) event.preventDefault();
}

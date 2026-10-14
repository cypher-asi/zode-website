import type { ReactElement } from "react";

/**
 * An inline script that runs as a hard load's HTML is parsed. Rendered in the
 * browser, which wouldn't run it, it's `text/plain` so React doesn't warn.
 */
export function InlineScript({ html }: { html: string }): ReactElement {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

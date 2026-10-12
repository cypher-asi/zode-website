import { tokensCss } from "@/features/styleguide/publish";

/** Design tokens as CSS custom properties, served at `/brand/tokens.css` (see the rewrites in next.config.ts). */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(tokensCss(), {
    headers: { "content-type": "text/css; charset=utf-8" },
  });
}

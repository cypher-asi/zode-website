import { tokensJson } from "@/features/styleguide/publish";

/** Design tokens as JSON, served at `/brand/tokens.json` (see the rewrites in next.config.ts). */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(tokensJson());
}

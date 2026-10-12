import { llmsTxt } from "@/features/styleguide/publish";

/** The llms.txt index for agents, served at `/llms.txt` (see the rewrites in next.config.ts). */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

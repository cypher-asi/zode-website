import { styleguideMarkdown } from "@/features/styleguide/publish";

/** The styleguide as Markdown for agents, served at `/styleguide.md` (see the rewrites in next.config.ts). */
export function GET(): Response {
  return new Response(styleguideMarkdown(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}

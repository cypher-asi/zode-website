import { redirect } from "next/navigation";
import { OuterShell } from "@/components/OuterShell";
import { Section } from "@/components/Section";
import { Cover, COVER_ID } from "@/components/Cover";
import { SECTIONS } from "@/content/sections";
import { isAuthenticated } from "@/lib/session";

/**
 * Public investor deck. Reachable at `/deck` regardless of the INVEST_ENABLED
 * flag (that flag only controls whether the "Invest" nav/footer button is
 * shown). The auth check mirrors the rest of the site: it's a no-op while the
 * shared-password gate is disabled, and defers to `/login` if it's turned on.
 */
export default async function Deck() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const railSections = SECTIONS.map(({ id, label }) => ({ id, label }));

  return (
    <OuterShell sections={railSections} coverId={COVER_ID}>
      <Cover />
      {SECTIONS.map((section) => (
        <Section key={section.id} section={section} />
      ))}
    </OuterShell>
  );
}

import { notFound, redirect } from "next/navigation";
import { OuterShell } from "@/components/OuterShell";
import { Section } from "@/components/Section";
import { Cover, COVER_ID } from "@/components/Cover";
import { SECTIONS } from "@/content/sections";
import { INVEST_ENABLED } from "@/lib/flags";
import { isAuthenticated } from "@/lib/session";

export default async function Invest() {
  // Gated behind a feature flag while the investor page is on hold.
  if (!INVEST_ENABLED) {
    notFound();
  }

  // Defense in depth: proxy.ts already gates this route, but re-check
  // here so content is never rendered without a valid session.
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

import { redirect } from "next/navigation";
import { OuterShell } from "@/components/OuterShell";
import { Section } from "@/components/Section";
import { Cover, COVER_ID } from "@/components/Cover";
import { SECTIONS } from "@/content/sections";
import { isAuthenticated } from "@/lib/session";

export default async function Invest() {
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

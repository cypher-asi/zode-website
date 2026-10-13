import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const instant = false;

/** Team invites emailed before invites moved to /invite/[token]. */
export default async function TeamInviteRedirect({ params }: PageProps<"/team/invite/[token]">): Promise<never> {
  const { token } = await params;
  permanentRedirect(`/invite/${encodeURIComponent(token)}`);
}

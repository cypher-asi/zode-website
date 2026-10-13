import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { LogoutButton } from "@/features/account/LogoutButton";
import { requireAccount } from "@/features/account/session";
import ui from "@/features/data-room/ui.module.css";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import { SettingsTabs } from "@/features/settings/SettingsTabs";
import settings from "@/features/settings/settings.module.css";
import { AddToTeamForm } from "@/features/team/AddToTeamForm";
import { InviteTeamForm } from "@/features/team/InviteTeamForm";
import { listPendingTeamInvites, type PendingTeamInvite } from "@/features/team/invites";
import { PendingTeamInvites, TeamList } from "@/features/team/TeamList";
import type { User } from "@/features/users/types";
import { listTeam, listUsers } from "@/features/users/users";

export const metadata: Metadata = {
  title: "Team | ZODE",
  robots: { index: false, follow: false },
};

const orNull = <T,>(promise: Promise<T>, what: string): Promise<T | null> =>
  promise.catch((error: unknown) => {
    console.error(`[team] couldn't load ${what}`, error);
    return null;
  });

/** The ZODE team. Everyone on it sees who else is; super admins invite, add and remove people. */
export default function TeamPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Settings"
        subtitle="The ZODE team, who can open data rooms. Super admins choose who's on it."
        tabs={<SettingsTabs current="team" />}
        actions={<LogoutButton className={ui.button} />}
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Team />
      </Suspense>
    </div>
  );
}

async function Team(): Promise<ReactElement> {
  const account = await requireAccount("/portal/settings/team");
  const [team, superAdmin] = await Promise.all([isTeam(account), isZodeAdmin(account)]);
  if (!team) notFound();

  const [members, invites, users] = await Promise.all([
    orNull(listTeam(), "the team"),
    superAdmin ? orNull(listPendingTeamInvites("team"), "team invites") : Promise.resolve<PendingTeamInvite[]>([]),
    superAdmin ? orNull(listUsers(), "users") : Promise.resolve<User[]>([]),
  ]);
  const candidates = (users ?? [])
    .filter((user) => user.role === "member")
    .map((user) => ({
      id: user.id,
      label: user.name || user.email || `User #${user.id}`,
      detail: user.name && user.email ? user.email : undefined,
    }));

  return (
    <>
      {superAdmin ? (
        <section className={styles.section} aria-labelledby="team-add">
          <div className={styles.sectionHead}>
            <h2 id="team-add" className={styles.sectionTitle}>
              Add to the team
            </h2>
          </div>
          <div className={settings.card}>
            <InviteTeamForm />
            <AddToTeamForm candidates={candidates} />
            <p className={settings.hint}>
              Invites go to people who may not have an account yet; they join once they sign in with that email.
            </p>
          </div>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="team-members">
        <div className={styles.sectionHead}>
          <h2 id="team-members" className={styles.sectionTitle}>
            Team
          </h2>
        </div>
        {members === null ? (
          <Empty>The team couldn&apos;t be loaded right now. Please try again shortly.</Empty>
        ) : (
          <TeamList team={members} selfZosUserId={account.userId} manage={superAdmin} />
        )}
      </section>

      {superAdmin && invites?.length ? (
        <section className={styles.section} aria-labelledby="team-invites">
          <div className={styles.sectionHead}>
            <h2 id="team-invites" className={styles.sectionTitle}>
              Pending invites
            </h2>
          </div>
          <PendingTeamInvites invites={invites} />
        </section>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import type { ReactElement } from "react";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { LogoutButton } from "@/features/account/LogoutButton";
import { avatarUrl, loadProfile } from "@/features/account/profile";
import { requireAccount } from "@/features/account/session";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import { SettingsSubscription } from "@/features/mailing-list/SettingsSubscription";
import { DevDbSwitch } from "@/features/portal/DevDbSwitch";
import { PageHeader } from "@/features/portal/sections";
import { devDbSwitchAvailable, devDbTarget } from "@/lib/db";
import styles from "@/features/portal/portal.module.css";
import { AvatarField } from "@/features/settings/AvatarField";
import { NameForm } from "@/features/settings/NameForm";
import { SettingsTabs } from "@/features/settings/SettingsTabs";
import settings from "@/features/settings/settings.module.css";
import { userIdFor } from "@/features/users/users";

export const metadata: Metadata = {
  title: "Settings | ZODE",
};

/** Your profile as the portal shows it, and the ZOS account behind it. */
export default async function SettingsPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal/settings");
  const [profile, zodeUserId] = await Promise.all([
    loadProfile(account.userId),
    userIdFor(account.userId).catch((error: unknown) => {
      console.error("[settings] couldn't load the ZODE user id", error);
      return null;
    }),
  ]);
  const photo = profile?.avatarPathname ? avatarUrl(account.userId, profile.avatarPathname) : null;
  const [superAdmin, team] = await Promise.all([isZodeAdmin(account), isTeam(account)]);
  const showDbSwitch = devDbSwitchAvailable() && superAdmin;

  return (
    <div className={styles.page}>
      <PageHeader title="Settings" subtitle="Your profile and account.">
        <div className={tabs.headerActions}>
          {team ? <SettingsTabs current="account" /> : null}
          <LogoutButton className={ui.button} />
        </div>
      </PageHeader>

      <section className={styles.section} aria-labelledby="settings-profile">
        <div className={styles.sectionHead}>
          <h2 id="settings-profile" className={styles.sectionTitle}>
            Profile
          </h2>
        </div>
        <div className={settings.card}>
          <AvatarField userId={account.userId} name={account.displayName} src={photo} />
          <NameForm name={account.displayName} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-account">
        <div className={styles.sectionHead}>
          <h2 id="settings-account" className={styles.sectionTitle}>
            Account
          </h2>
        </div>
        <div className={settings.card}>
          <dl className={settings.details}>
            <dt>User ID</dt>
            <dd>{zodeUserId ? `#${zodeUserId}` : "—"}</dd>
            <dt>Email</dt>
            <dd>{account.email}</dd>
            <dt>ZID</dt>
            <dd>{account.primaryZid || "—"}</dd>
          </dl>
          <p className={settings.hint}>Your email and ZID belong to your ZOS account and can&apos;t be changed here.</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-mailing-list">
        <div className={styles.sectionHead}>
          <h2 id="settings-mailing-list" className={styles.sectionTitle}>
            Mailing list
          </h2>
        </div>
        <div className={settings.card}>
          <SettingsSubscription account={account} />
        </div>
      </section>

      {showDbSwitch ? (
        <section className={styles.section} aria-labelledby="settings-database">
          <div className={styles.sectionHead}>
            <h2 id="settings-database" className={styles.sectionTitle}>
              Database
            </h2>
          </div>
          <div className={settings.card}>
            <DevDbSwitch current={devDbTarget()} />
            <p className={settings.hint}>
              Local development only. Points the whole server at the dev or prod database; sessions stay in the dev
              database.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

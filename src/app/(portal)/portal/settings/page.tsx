import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { LogoutButton } from "@/features/account/LogoutButton";
import ui from "@/features/data-room/ui.module.css";
import { SettingsSubscription } from "@/features/mailing-list/SettingsSubscription";
import { DevDbSwitch } from "@/features/portal/DevDbSwitch";
import { loadMySettings, orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { PageHeader } from "@/features/portal/sections";
import { devDbSwitchAvailable, devDbTarget } from "@/lib/db";
import styles from "@/features/portal/portal.module.css";
import { AvatarField } from "@/features/settings/AvatarField";
import { NameForm } from "@/features/settings/NameForm";
import { SettingsTabs } from "@/features/settings/SettingsTabs";
import settings from "@/features/settings/settings.module.css";

export const metadata: Metadata = {
  title: "Settings | ZODE",
};

/** Your profile as the portal shows it, and the ZOS account behind it. */
export default function SettingsPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Settings"
        subtitle="Your profile and account."
        tabs={
          <Suspense fallback={null}>
            <TeamTabs />
          </Suspense>
        }
        actions={<LogoutButton className={ui.button} />}
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Settings />
      </Suspense>
    </div>
  );
}

/** The tabs over to the team, for the ZODE team. */
async function TeamTabs(): Promise<ReactElement | null> {
  const mine = await loadMySettings();
  return mine?.team ? <SettingsTabs current="account" /> : null;
}

async function Settings(): Promise<ReactElement> {
  const { account, photo, zodeUserId, superAdmin } = orLogIn(await loadMySettings(), "/portal/settings");
  const showDbSwitch = devDbSwitchAvailable() && superAdmin;

  return (
    <>
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
          {/* Uncached, so it streams in on its own and the rest stays in the prefetched shell. */}
          <Suspense fallback={null}>
            <SettingsSubscription account={account} />
          </Suspense>
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
    </>
  );
}

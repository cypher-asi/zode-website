import "server-only";
import type { ReactElement } from "react";
import type { Account } from "@/features/account/zos";
import settings from "@/features/settings/settings.module.css";
import { accountSubscribeAction, accountUnsubscribeAction } from "./actions";
import { MailingListButton } from "./MailingListButton";
import { subscriptionFor } from "./subscribers";
import styles from "./MailingList.module.css";

/** Portal settings: whether the account gets ZODE news, and the button to change it. */
export async function SettingsSubscription({ account }: { account: Account }): Promise<ReactElement> {
  const subscription = await subscriptionFor(account).catch((error: unknown) => {
    console.error("[mailing-list] couldn't load the account's subscription", error);
    return undefined;
  });
  if (subscription === undefined) {
    return <p className={settings.hint}>Your mailing list status couldn&apos;t be loaded right now.</p>;
  }

  const status = subscription?.status ?? "unsubscribed";
  const email = subscription?.email ?? account.email;
  let text: ReactElement;
  let button: ReactElement;
  if (status === "subscribed") {
    text = (
      <>
        Subscribed with {email}
        <small>You get an email when we publish news or changelog updates.</small>
      </>
    );
    button = (
      <MailingListButton
        run={accountUnsubscribeAction}
        label="Unsubscribe"
        pendingLabel="Unsubscribing…"
        variant="button"
      />
    );
  } else if (status === "pending") {
    text = (
      <>
        Waiting for confirmation
        <small>We emailed a confirmation link to {email}. It works for 7 days.</small>
      </>
    );
    button = (
      <MailingListButton
        run={accountSubscribeAction}
        label="Resend link"
        pendingLabel="Sending…"
        variant="button"
      />
    );
  } else {
    text = (
      <>
        Not subscribed
        <small>Get an email when we publish news or changelog updates. We&apos;ll send a link to {account.email} to confirm.</small>
      </>
    );
    button = <MailingListButton run={accountSubscribeAction} label="Subscribe" pendingLabel="Subscribing…" />;
  }

  return (
    <div className={styles.status}>
      <p className={styles.statusText}>{text}</p>
      <div key={status}>{button}</div>
    </div>
  );
}

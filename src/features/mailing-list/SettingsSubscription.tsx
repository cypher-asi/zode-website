import "server-only";
import type { ReactElement } from "react";
import type { Account } from "@/features/account/zos";
import settings from "@/features/settings/settings.module.css";
import { accountSubscribeAction, accountUnsubscribeAction } from "./actions";
import { MailingListButton } from "./MailingListButton";
import { subscriptionsFor } from "./subscribers";
import { MAILING_LISTS, type Subscriber } from "./types";
import styles from "./MailingList.module.css";

function ListStatus({
  list,
  subscription,
  account,
}: {
  list: (typeof MAILING_LISTS)[number];
  subscription: Subscriber | undefined;
  account: Account;
}): ReactElement {
  const status = subscription?.status ?? "unsubscribed";
  const email = subscription?.email ?? account.email;
  let text: ReactElement;
  let button: ReactElement;
  if (status === "subscribed") {
    text = (
      <>
        {list.label}: subscribed with {email}
        <small>You get an email when {list.when}.</small>
      </>
    );
    button = (
      <MailingListButton
        run={accountUnsubscribeAction.bind(null, list.id)}
        label="Unsubscribe"
        pendingLabel="Unsubscribing…"
        variant="button"
      />
    );
  } else if (status === "pending") {
    text = (
      <>
        {list.label}: waiting for confirmation
        <small>We emailed a confirmation link to {email}. It works for 7 days.</small>
      </>
    );
    button = (
      <MailingListButton
        run={accountSubscribeAction.bind(null, list.id)}
        label="Resend link"
        pendingLabel="Sending…"
        variant="button"
      />
    );
  } else {
    text = (
      <>
        {list.label}: not subscribed
        <small>
          Get an email when {list.when}. We&apos;ll send a link to {account.email} to confirm.
        </small>
      </>
    );
    button = (
      <MailingListButton run={accountSubscribeAction.bind(null, list.id)} label="Subscribe" pendingLabel="Subscribing…" />
    );
  }

  return (
    <div className={styles.status}>
      <p className={styles.statusText}>{text}</p>
      <div key={status}>{button}</div>
    </div>
  );
}

/** Portal settings: which mailing lists the account is on, and a button to change each. */
export async function SettingsSubscription({ account }: { account: Account }): Promise<ReactElement> {
  const subscriptions = await subscriptionsFor(account).catch((error: unknown) => {
    console.error("[mailing-list] couldn't load the account's subscriptions", error);
    return undefined;
  });
  if (subscriptions === undefined) {
    return <p className={settings.hint}>Your mailing list status couldn&apos;t be loaded right now.</p>;
  }

  return (
    <div className={styles.lists}>
      {MAILING_LISTS.map((list) => (
        <ListStatus
          key={list.id}
          list={list}
          subscription={subscriptions.find((row) => row.list === list.id)}
          account={account}
        />
      ))}
    </div>
  );
}

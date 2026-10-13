import type { Metadata } from "next";
import type { ReactElement } from "react";
import { unsubscribeAction } from "@/features/mailing-list/actions";
import { MailingListButton } from "@/features/mailing-list/MailingListButton";
import { getEmail, verifyUnsubscribe } from "@/features/mailing-list/subscribers";
import { mailingList, type MailingList } from "@/features/mailing-list/types";
import styles from "@/features/data-room/invite.module.css";

export const metadata: Metadata = {
  title: "Unsubscribe | ZODE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const instant = false;

const Unsubscribed = ({ email, list }: { email: string; list: MailingList }): ReactElement => (
  <>
    <h1 className={styles.title}>You&apos;re unsubscribed</h1>
    <p className={styles.text}>
      We won&apos;t send {mailingList(list).topic} to <strong>{email}</strong> anymore. Changed your mind? Sign up
      again on the {mailingList(list).label} page.
    </p>
  </>
);

/** The link at the bottom of every mailing list email. It's signed per subscriber, so it works without logging in. */
export default async function UnsubscribePage({ searchParams }: PageProps<"/mailing-list/unsubscribe">): Promise<ReactElement> {
  const { id, sig } = await searchParams;
  const subscriber = verifyUnsubscribe(id, sig)
    ? await getEmail(id).catch((error: unknown) => {
        console.error("[mailing-list] unsubscribe lookup failed", error);
        return undefined;
      })
    : null;

  let body: ReactElement;
  if (subscriber === undefined) {
    body = (
      <>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.text}>We couldn&apos;t check this link just now. Please try again shortly.</p>
      </>
    );
  } else if (!subscriber) {
    body = (
      <>
        <h1 className={styles.title}>This unsubscribe link isn&apos;t valid</h1>
        <p className={styles.text}>Use the link at the bottom of one of our emails, or reply to it and we&apos;ll take you off the list.</p>
      </>
    );
  } else if (subscriber.status === "unsubscribed") {
    body = <Unsubscribed email={subscriber.email} list={subscriber.list} />;
  } else {
    const { topic } = mailingList(subscriber.list);
    body = (
      <>
        <p className={styles.eyebrow}>Mailing list</p>
        <h1 className={styles.title}>Unsubscribe from {topic}?</h1>
        <p className={styles.text}>
          <strong>{subscriber.email}</strong> will stop getting {topic} by email. Other ZODE mailing lists
          aren&apos;t affected.
        </p>
        <MailingListButton
          run={unsubscribeAction.bind(null, id as string, sig as string)}
          label="Unsubscribe"
          pendingLabel="Unsubscribing…"
          done={<Unsubscribed email={subscriber.email} list={subscriber.list} />}
        />
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>{body}</div>
    </div>
  );
}

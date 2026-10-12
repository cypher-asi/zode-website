import type { Metadata } from "next";
import type { ReactElement } from "react";
import { unsubscribeAction } from "@/features/mailing-list/actions";
import { MailingListButton } from "@/features/mailing-list/MailingListButton";
import { getEmail, verifyUnsubscribe } from "@/features/mailing-list/subscribers";
import styles from "@/features/data-room/invite.module.css";

export const metadata: Metadata = {
  title: "Unsubscribe | ZODE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const Unsubscribed = ({ email }: { email: string }): ReactElement => (
  <>
    <h1 className={styles.title}>You&apos;re unsubscribed</h1>
    <p className={styles.text}>
      We won&apos;t send ZODE news to <strong>{email}</strong> anymore. Changed your mind? Sign up again on the News page.
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
    body = <Unsubscribed email={subscriber.email} />;
  } else {
    body = (
      <>
        <p className={styles.eyebrow}>Mailing list</p>
        <h1 className={styles.title}>Unsubscribe from ZODE news?</h1>
        <p className={styles.text}>
          <strong>{subscriber.email}</strong> will stop getting news and changelog emails.
        </p>
        <MailingListButton
          run={unsubscribeAction.bind(null, id as string, sig as string)}
          label="Unsubscribe"
          pendingLabel="Unsubscribing…"
          done={<Unsubscribed email={subscriber.email} />}
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

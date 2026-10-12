import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { confirmSubscriptionAction } from "@/features/mailing-list/actions";
import { MailingListButton } from "@/features/mailing-list/MailingListButton";
import { findConfirmation } from "@/features/mailing-list/subscribers";
import styles from "@/features/data-room/invite.module.css";
import ui from "@/features/data-room/ui.module.css";

export const metadata: Metadata = {
  title: "Confirm your subscription | ZODE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const Subscribed = ({ email }: { email: string }): ReactElement => (
  <>
    <h1 className={styles.title}>You&apos;re subscribed</h1>
    <p className={styles.text}>
      We&apos;ll email <strong>{email}</strong> when we publish news or changelog updates. Every email has an
      unsubscribe link.
    </p>
    <Link className={ui.button} href="/news">
      Read the latest news
    </Link>
  </>
);

/** Where confirmation emails land. Confirming takes a button press, so mail scanners opening the link don't subscribe anyone. */
export default async function ConfirmSubscriptionPage({
  params,
}: PageProps<"/mailing-list/confirm/[token]">): Promise<ReactElement> {
  const { token } = await params;
  const pending = await findConfirmation(token).catch((error: unknown) => {
    console.error("[mailing-list] confirmation lookup failed", error);
    return undefined;
  });

  let body: ReactElement;
  if (pending === undefined) {
    body = (
      <>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.text}>We couldn&apos;t check this link just now. Please try again shortly.</p>
      </>
    );
  } else if (!pending || pending.expired) {
    body = (
      <>
        <h1 className={styles.title}>{pending ? "This link has expired" : "This link isn't valid"}</h1>
        <p className={styles.text}>
          {pending
            ? "Confirmation links work for 7 days. Sign up again and we'll send you a new one."
            : "It may have been used already or replaced by a newer link. Sign up again to get a fresh one."}
        </p>
        <Link className={ui.primary} href="/news">
          Go to News
        </Link>
      </>
    );
  } else {
    body = (
      <>
        <p className={styles.eyebrow}>Mailing list</p>
        <h1 className={styles.title}>Confirm your subscription</h1>
        <p className={styles.text}>
          Get ZODE news and changelog updates at <strong>{pending.email}</strong>.
        </p>
        <MailingListButton
          run={confirmSubscriptionAction.bind(null, token)}
          label="Confirm subscription"
          pendingLabel="Confirming…"
          done={<Subscribed email={pending.email} />}
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

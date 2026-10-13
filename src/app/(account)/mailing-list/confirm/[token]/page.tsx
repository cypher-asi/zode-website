import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { confirmSubscriptionAction } from "@/features/mailing-list/actions";
import { MailingListButton } from "@/features/mailing-list/MailingListButton";
import { findConfirmation } from "@/features/mailing-list/subscribers";
import { mailingList, type MailingList } from "@/features/mailing-list/types";
import styles from "@/features/data-room/invite.module.css";
import ui from "@/features/data-room/ui.module.css";

export const metadata: Metadata = {
  title: "Confirm your subscription | ZODE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const topicOf = (lists: MailingList[]): string =>
  lists.length > 1 ? "ZODE news and changelog updates" : mailingList(lists[0]).topic;

const whenOf = (lists: MailingList[]): string =>
  lists.length > 1 ? "we publish news or changelog updates" : mailingList(lists[0]).when;

const Subscribed = ({ email, lists }: { email: string; lists: MailingList[] }): ReactElement => (
  <>
    <h1 className={styles.title}>You&apos;re subscribed</h1>
    <p className={styles.text}>
      We&apos;ll email <strong>{email}</strong> when {whenOf(lists)}. Every email has an unsubscribe link.
    </p>
    <Link className={ui.button} href={`/${lists[0]}`}>
      {lists[0] === "changelog" ? "Read the changelog" : "Read the latest news"}
    </Link>
  </>
);

/** Where confirmation emails land. Confirming takes a button press, so mail scanners opening the link don't subscribe anyone. */
export default function ConfirmSubscriptionPage({ params }: PageProps<"/mailing-list/confirm/[token]">): ReactElement {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Suspense fallback={<p className={styles.text}>Checking your link…</p>}>
          <Confirmation params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Confirmation({
  params,
}: Pick<PageProps<"/mailing-list/confirm/[token]">, "params">): Promise<ReactElement> {
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
          Get {topicOf(pending.lists)} at <strong>{pending.email}</strong>.
        </p>
        <MailingListButton
          run={confirmSubscriptionAction.bind(null, token)}
          label="Confirm subscription"
          pendingLabel="Confirming…"
          done={<Subscribed email={pending.email} lists={pending.lists} />}
        />
      </>
    );
  }

  return body;
}

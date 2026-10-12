import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import { SUBSCRIBER_STATUSES, isSubscriberStatus } from "@/features/mailing-list/types";
import { loadSubscribers } from "@/features/portal/data";
import { Empty, PageHeader, SubscriberList } from "@/features/portal/sections";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import styles from "@/features/portal/portal.module.css";
import admin from "@/features/posts/PostEditor.module.css";

export const metadata: Metadata = {
  title: "Subscribers | ZODE",
  robots: { index: false, follow: false },
};

const TABS = [
  { id: "all", label: "All", href: "/portal/subscribers" },
  ...SUBSCRIBER_STATUSES.map((status) => ({ ...status, href: `/portal/subscribers?status=${status.id}` })),
];

/** Everyone on the mailing list, and which of them have ZODE accounts. ZODE admins only. */
export default async function SubscribersPage({ searchParams }: PageProps<"/portal/subscribers">): Promise<ReactElement> {
  const account = await requireAccount("/portal/subscribers");
  if (!isZodeAdmin(account)) notFound();
  const { status } = await searchParams;
  const filter = isSubscriberStatus(status) ? status : null;
  const subscribers = await loadSubscribers();
  const shown = subscribers && filter ? subscribers.filter((subscriber) => subscriber.status === filter) : subscribers;

  const count = (id: string) => subscribers?.filter((subscriber) => subscriber.status === id).length ?? 0;
  const stats = [
    { label: "Subscribed", value: count("subscribed"), href: "/portal/subscribers?status=subscribed" },
    { label: "Awaiting confirmation", value: count("pending"), href: "/portal/subscribers?status=pending" },
    { label: "Unsubscribed", value: count("unsubscribed"), href: "/portal/subscribers?status=unsubscribed" },
    {
      label: "Subscribed with an account",
      value: subscribers?.filter((subscriber) => subscriber.status === "subscribed" && subscriber.userId).length ?? 0,
      href: "/portal/subscribers?status=subscribed",
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Subscribers"
        subtitle="The news and changelog mailing list. Only subscribed addresses have confirmed by email."
      >
        <a className={ui.button} href={`/api/mailing-list/export${filter ? `?status=${filter}` : ""}`} download>
          Export CSV
        </a>
      </PageHeader>
      {subscribers ? (
        <div className={styles.stats}>
          {stats.map((stat) => (
            <Link key={stat.label} className={styles.stat} href={stat.href}>
              <span className={styles.statValue}>{stat.value.toLocaleString("en-US")}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <nav className={admin.filter} aria-label="Subscriber status">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={tabs.tab}
            aria-current={(filter ?? "all") === tab.id ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {shown === null ? (
        <Empty>The mailing list couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : shown.length ? (
        <SubscriberList subscribers={shown} />
      ) : (
        <Empty>
          {filter ? "No one here yet." : "No one has signed up yet. The form is on the News and Changelog pages."}
        </Empty>
      )}
    </div>
  );
}

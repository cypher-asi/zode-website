import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isZodeAdmin } from "@/features/account/admin";
import { requireAccount } from "@/features/account/session";
import {
  MAILING_LISTS,
  SUBSCRIBER_STATUSES,
  isMailingList,
  isSubscriberStatus,
  mailingList,
  type MailingList,
} from "@/features/mailing-list/types";
import { loadSubscribers } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader, SubscriberList } from "@/features/portal/sections";
import tabs from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";
import styles from "@/features/portal/portal.module.css";
import admin from "@/features/posts/PostEditor.module.css";

export const metadata: Metadata = {
  title: "Subscribers | ZODE",
  robots: { index: false, follow: false },
};

const LIST_TABS: readonly { id: MailingList | "all"; label: string; href: string }[] = [
  { id: "all", label: "All", href: "/portal/subscribers" },
  ...MAILING_LISTS.map((list) => ({ id: list.id, label: list.label, href: `/portal/subscribers/${list.id}` })),
];

/**
 * Everyone on the mailing lists, or one list, and which of them have ZODE
 * accounts. Someone on both lists is a row on each. ZODE admins only.
 */
export default function SubscribersPage({ params, searchParams }: PageProps<"/portal/subscribers/[[...list]]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Subscribers params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** The whole page, header included, since its title, tabs and export follow the URL. */
async function Subscribers({
  params,
  searchParams,
}: Pick<PageProps<"/portal/subscribers/[[...list]]">, "params" | "searchParams">): Promise<ReactElement> {
  const { list: segments } = await params;
  const list = segments && isMailingList(segments[0]) ? segments[0] : null;
  if (segments && (segments.length > 1 || !list)) notFound();
  const base = list ? `/portal/subscribers/${list}` : "/portal/subscribers";

  const account = await requireAccount(base);
  if (!(await isZodeAdmin(account))) notFound();
  const { status } = await searchParams;
  const filter = isSubscriberStatus(status) ? status : null;
  const subscribers = await loadSubscribers(list);
  const shown = subscribers && filter ? subscribers.filter((subscriber) => subscriber.status === filter) : subscribers;

  const count = (id: string) => subscribers?.filter((subscriber) => subscriber.status === id).length ?? 0;
  const stats = [
    { label: "Subscribed", value: count("subscribed"), href: `${base}?status=subscribed` },
    { label: "Awaiting confirmation", value: count("pending"), href: `${base}?status=pending` },
    { label: "Unsubscribed", value: count("unsubscribed"), href: `${base}?status=unsubscribed` },
    {
      label: "Subscribed with an account",
      value: subscribers?.filter((subscriber) => subscriber.status === "subscribed" && subscriber.userId).length ?? 0,
      href: `${base}?status=subscribed`,
    },
  ];
  const statusTabs = [
    { id: "all", label: "All", href: base },
    ...SUBSCRIBER_STATUSES.map((s) => ({ ...s, href: `${base}?status=${s.id}` })),
  ];
  const exportQuery = new URLSearchParams({ ...(list ? { list } : {}), ...(filter ? { status: filter } : {}) }).toString();

  return (
    <div className={styles.page}>
      <PageHeader
        title={list ? `${mailingList(list).label} subscribers` : "Subscribers"}
        subtitle={
          list
            ? `The ${mailingList(list).label} mailing list. Only subscribed addresses have confirmed by email.`
            : "Both mailing lists, a row per list. Only subscribed addresses have confirmed by email."
        }
      >
        <div className={tabs.headerActions}>
          <nav className={tabs.tabs} aria-label="Mailing lists">
            {LIST_TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={tabs.tab}
                aria-current={(list ?? "all") === tab.id ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <a className={ui.button} href={`/api/mailing-list/export${exportQuery ? `?${exportQuery}` : ""}`} download>
            Export CSV
          </a>
        </div>
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
        {statusTabs.map((tab) => (
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
        <SubscriberList subscribers={shown} showList={!list} />
      ) : (
        <Empty>
          {filter
            ? "No one here yet."
            : list
              ? `No one has signed up yet. The form is on the ${mailingList(list).label} page and its posts.`
              : "No one has signed up yet. The forms are on the News and Changelog pages."}
        </Empty>
      )}
    </div>
  );
}

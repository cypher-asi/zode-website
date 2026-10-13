import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAD_STATUSES, LEAD_TYPES, isLeadStatus, isLeadType, leadType, type LeadType } from "@/features/leads/types";
import { loadLeads } from "@/features/portal/data";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, LeadList, PageHeader } from "@/features/portal/sections";
import { requireTeam } from "@/features/zrm/access";
import tabs from "@/features/data-room/room.module.css";
import styles from "@/features/portal/portal.module.css";
import admin from "@/features/posts/PostEditor.module.css";

export const metadata: Metadata = {
  title: "Leads | ZODE",
  robots: { index: false, follow: false },
};

const TYPE_TABS: readonly { id: LeadType | "all"; label: string; href: string }[] = [
  { id: "all", label: "All", href: "/portal/leads" },
  ...LEAD_TYPES.map((type) => ({ id: type.id, label: type.label, href: `/portal/leads/${type.id}` })),
];

const SUBTITLES: Record<LeadType | "all", string> = {
  all: "Orders, Talk to an Engineer requests and Invest inquiries from the site.",
  buy: "Configurator purchases and engineer requests about buying a ZODE.",
  rent: "Configurator rentals and engineer requests about renting compute.",
  invest: "Inquiries from the Invest form about company equity and project finance.",
};

/**
 * Everyone who's asked to buy or rent compute or to invest, or one of the
 * three, with where the team stands with each. ZODE team only.
 */
export default function LeadsPage({ params, searchParams }: PageProps<"/portal/leads/[[...type]]">): ReactElement {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Leads params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** The whole page, header included, since its title, tabs and figures follow the URL. */
async function Leads({
  params,
  searchParams,
}: Pick<PageProps<"/portal/leads/[[...type]]">, "params" | "searchParams">): Promise<ReactElement> {
  const { type: segments } = await params;
  const type = segments && isLeadType(segments[0]) ? segments[0] : null;
  if (segments && (segments.length > 1 || !type)) notFound();
  const base = type ? `/portal/leads/${type}` : "/portal/leads";

  await requireTeam(base);
  const { status } = await searchParams;
  const filter = isLeadStatus(status) ? status : null;
  const leads = await loadLeads();
  const ofType = leads && type ? leads.filter((lead) => lead.types.includes(type)) : leads;
  const shown = ofType && filter ? ofType.filter((lead) => lead.status === filter) : ofType;

  const stats = LEAD_STATUSES.map((s) => ({
    label: s.label,
    value: ofType?.filter((lead) => lead.status === s.id).length ?? 0,
    href: `${base}?status=${s.id}`,
  }));
  const statusTabs = [
    { id: "all", label: "All", href: base },
    ...LEAD_STATUSES.map((s) => ({ ...s, href: `${base}?status=${s.id}` })),
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title={type ? `${leadType(type).label} leads` : "Leads"}
        subtitle={SUBTITLES[type ?? "all"]}
        tabs={
          <nav className={tabs.tabs} aria-label="Lead types">
            {TYPE_TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={tabs.tab}
                aria-current={(type ?? "all") === tab.id ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        }
      />
      {ofType ? (
        <div className={styles.stats}>
          {stats.map((stat) => (
            <Link key={stat.label} className={styles.stat} href={stat.href}>
              <span className={styles.statValue}>{stat.value.toLocaleString("en-US")}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <nav className={admin.filter} aria-label="Lead status">
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
        <Empty>Leads couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : shown.length ? (
        <LeadList leads={shown} />
      ) : (
        <Empty>
          {filter
            ? "No leads here yet."
            : type === "invest"
              ? "No investor inquiries yet. They come in through the Invest form."
              : type
                ? `No ${leadType(type).label.toLowerCase()} leads yet. They come in through the configurator and Talk to an Engineer.`
                : "No leads yet. They come in through the configurator, Talk to an Engineer and the Invest form."}
        </Empty>
      )}
    </div>
  );
}

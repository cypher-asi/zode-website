import type { ReactElement } from "react";
import Link from "next/link";
import tabStyles from "@/features/data-room/room.module.css";
import { hrefWith, NONE, type Dimension, type Filters } from "./filters";
import { dimensionLabel, formatValue } from "./format";
import { PAGE_SIZE, type BreakdownRow, type BreakdownSort, type Paged } from "./queries";
import { ReportTable, type Column } from "./ReportTable";
import { ANALYTICS_PATH } from "./report";
import styles from "./analytics.module.css";

/** A report's sections as tabs, e.g. Channels, Referrers and Campaigns. */
export function ReportTabs({
  tabs,
  current,
  label,
}: {
  tabs: readonly { id: string; label: string; href: string }[];
  current: string;
  label: string;
}): ReactElement {
  return (
    <nav className={tabStyles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={tabStyles.tab}
          aria-current={tab.id === current ? "page" : undefined}
          scroll={false}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

const COLUMNS: Column<BreakdownSort>[] = [
  { id: "key", label: "" },
  { id: "visitors", label: "Visitors", metric: "visitors" },
  { id: "sessions", label: "Sessions", metric: "sessions" },
  { id: "pageviews", label: "Pageviews", metric: "pageviews" },
  { id: "bounce_rate", label: "Bounce rate", metric: "bounce_rate" },
  { id: "session_duration", label: "Session duration", metric: "session_duration" },
  { id: "conversions", label: "Conversions", metric: "conversions" },
  { id: "conversion_rate", label: "Conversion rate", metric: "conversion_rate" },
];

/**
 * Sessions by one dimension as a sortable table. Each row opens the Overview
 * filtered to it, so a source or country can be followed through every report.
 */
export function BreakdownTable({
  path,
  filters,
  dim,
  dimLabel,
  data,
  sort,
  dir,
  page,
  keep,
}: {
  path: string;
  filters: Filters;
  dim: Dimension;
  dimLabel: string;
  data: Paged<BreakdownRow>;
  sort: BreakdownSort;
  dir: "asc" | "desc";
  page: number;
  keep: Record<string, string | undefined>;
}): ReactElement {
  const columns = COLUMNS.map((column) => (column.id === "key" ? { ...column, label: dimLabel } : column));
  return (
    <ReportTable
      columns={columns}
      rows={data.rows.map((row) => ({
        key: row.key ?? NONE,
        cells: [
          <Link
            key="key"
            className={styles.cellLink}
            href={hrefWith(ANALYTICS_PATH, filters, { dims: { [dim]: row.key ?? NONE } })}
            title={`Open the Overview for ${dimensionLabel(dim, row.key)}`}
          >
            {dimensionLabel(dim, row.key)}
          </Link>,
          formatValue(row.visitors, "count"),
          formatValue(row.sessions, "count"),
          formatValue(row.pageviews, "count"),
          formatValue(row.bounceRate, "percent"),
          formatValue(row.sessionDuration, "duration"),
          formatValue(row.conversions, "count"),
          formatValue(row.conversionRate, "percent"),
        ],
      }))}
      sort={sort}
      dir={dir}
      sortHref={(column, next) => hrefWith(path, filters, {}, { ...keep, sort: column, dir: next, page: null })}
      page={page}
      pageSize={PAGE_SIZE}
      total={data.total}
      pageHref={(next) => hrefWith(path, filters, {}, { ...keep, sort, dir, page: next || null })}
    />
  );
}

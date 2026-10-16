import type { ReactNode } from "react";
import { Avatar, Badge, Icon, TypeBadges } from "./bits";
import { formatDate } from "./fieldUi";
import {
  formatMoney,
  formatMw,
  personName,
  type CompanyRow,
  type Option,
  type OpportunityRow,
  type PersonRow,
  type RecordKind,
  type SiteGroup,
  type SiteRow,
  type SiteStatus,
  type ZrmType,
} from "./types";
import styles from "./zrm.module.css";

export interface Column<T> {
  key: string;
  header: string;
  /** A CSS grid track. */
  width: string;
  sortValue?: (row: T) => string | number | null;
  align?: "end";
  /** Dropped on phones. */
  wideOnly?: boolean;
  render: (row: T) => ReactNode;
  /** The column's cell in the total row under each section. */
  total?: (rows: readonly T[]) => ReactNode;
}

/** A select in the toolbar narrowing the list, e.g. to one type. Lists only the options some row has. */
export interface ListFilter<T> {
  key: string;
  label: string;
  /** The first option, which shows every row. */
  all: string;
  options: (rows: readonly T[]) => Option[];
  test: (row: T, value: string) => boolean;
  /** Also listed in the portal sidebar, so the toolbar drops it on windows wide enough to show that. */
  sidebar?: boolean;
}

/**
 * Headed groups of rows, in `order`, shown while the list isn't sorted by a
 * column. Each ends in a total row when some column has a `total`.
 */
export interface ListSections<T> {
  of: (row: T) => { key: string; label: string; order: number };
}

export interface ListConfig<T> {
  columns: readonly Column<T>[];
  /** Lower-cased text the search box matches against. */
  searchText: (row: T) => string;
  noun: [singular: string, plural: string];
  summary?: (rows: readonly T[]) => string;
  filters?: readonly ListFilter<T>[];
  sections?: ListSections<T>;
}

type Types = ReadonlyMap<string, ZrmType>;

function Primary({ name, sub, shape, active }: { name: string; sub?: string | null; shape?: "square"; active: boolean }) {
  return (
    <span className={styles.primaryCell}>
      <Avatar name={name} shape={shape} />
      <span className={styles.names}>
        <span className={styles.name}>
          {name}
          {active ? <Icon name="star" className={styles.pin} /> : null}
        </span>
        {sub ? <span className={styles.sub}>{sub}</span> : null}
      </span>
    </span>
  );
}

const typeColumn = <T extends { type_ids: string[] }>(types: Types): Column<T> => ({
  key: "type",
  header: "Type",
  width: "minmax(0, 1fr)",
  wideOnly: true,
  sortValue: (row) => types.get(row.type_ids[0] ?? "")?.name ?? null,
  render: (row) => <TypeBadges ids={row.type_ids} types={types} />,
});

const typeFilter = <T extends { type_ids: string[] }>(types: Types): ListFilter<T> => ({
  key: "type",
  label: "Filter by type",
  all: "All types",
  options: (rows) => {
    const used = new Set(rows.flatMap((row) => row.type_ids));
    return [...types.values()].filter((type) => used.has(type.id)).map((type) => ({ value: type.id, label: type.name }));
  },
  test: (row, value) => row.type_ids.includes(value),
  sidebar: true,
});

const lower = (...parts: (string | null | undefined)[]): string => parts.filter(Boolean).join(" ").toLowerCase();

export function peopleConfig(types: Types): ListConfig<PersonRow> {
  return {
    noun: ["person", "people"],
    searchText: (p) => lower(personName(p), p.title, p.email, p.company_name),
    filters: [typeFilter(types)],
    columns: [
      {
        key: "name",
        header: "Name",
        width: "minmax(0, 2fr)",
        sortValue: (p) => personName(p).toLowerCase(),
        render: (p) => <Primary name={personName(p)} sub={p.title} active={p.active} />,
      },
      {
        key: "company",
        header: "Company",
        width: "minmax(0, 1.3fr)",
        sortValue: (p) => p.company_name?.toLowerCase() ?? null,
        render: (p) => p.company_name,
      },
      typeColumn(types),
    ],
  };
}

export function companiesConfig(types: Types): ListConfig<CompanyRow> {
  return {
    noun: ["company", "companies"],
    searchText: (c) => lower(c.name, c.industry, c.domain, c.country),
    filters: [typeFilter(types)],
    columns: [
      {
        key: "name",
        header: "Name",
        width: "minmax(0, 2fr)",
        sortValue: (c) => c.name.toLowerCase(),
        render: (c) => <Primary name={c.name} sub={c.domain} shape="square" active={c.active} />,
      },
      {
        key: "industry",
        header: "Industry",
        width: "minmax(0, 1.3fr)",
        wideOnly: true,
        sortValue: (c) => c.industry?.toLowerCase() ?? null,
        render: (c) => c.industry,
      },
      {
        key: "employees",
        header: "Employees",
        width: "88px",
        align: "end",
        sortValue: (c) => c.employee_count,
        render: (c) => c.employee_count?.toLocaleString("en-US"),
      },
      typeColumn(types),
    ],
  };
}

export function opportunitiesConfig(types: Types): ListConfig<OpportunityRow> {
  return {
    noun: ["opportunity", "opportunities"],
    searchText: (o) => lower(o.title, o.person_name, o.company_name, o.stage_name),
    filters: [typeFilter(types)],
    summary: (rows) => `${formatMoney(rows.reduce((sum, o) => sum + (o.value ?? 0), 0))} total`,
    columns: [
      {
        key: "title",
        header: "Title",
        width: "minmax(0, 2fr)",
        sortValue: (o) => o.title.toLowerCase(),
        render: (o) => <Primary name={o.title} sub={[o.person_name, o.company_name].filter(Boolean).join(" · ")} active={o.active} />,
      },
      {
        key: "stage",
        header: "Stage",
        width: "minmax(0, 1.2fr)",
        sortValue: (o) => o.stage_position,
        render: (o) => <Badge>{o.stage_name}</Badge>,
      },
      {
        key: "value",
        header: "Value",
        width: "96px",
        align: "end",
        sortValue: (o) => o.value,
        render: (o) => formatMoney(o.value),
      },
    ],
  };
}

const sum = (rows: readonly SiteRow[], value: (row: SiteRow) => number | null): number =>
  rows.reduce((total, row) => total + (value(row) ?? 0), 0);

/** The dollar figures the sheet totals, leaving out those no site has. */
const moneyTotals = (rows: readonly SiteRow[]): string[] =>
  (
    [
      ["upfront", sum(rows, (s) => s.upfront)],
      ["conversion", sum(rows, (s) => s.conversion)],
      ["contract", sum(rows, (s) => s.contract_value)],
      ["a year", sum(rows, (s) => s.annual_revenue)],
    ] as const
  )
    .filter(([, total]) => total > 0)
    .map(([label, total]) => `${formatMoney(total)} ${label}`);

export function sitesConfig(groups: readonly SiteGroup[], statuses: readonly SiteStatus[]): ListConfig<SiteRow> {
  const groupOf = new Map(groups.map((group) => [group.id, group]));
  const statusOf = new Map(statuses.map((status) => [status.id, status]));
  return {
    noun: ["site", "sites"],
    searchText: (s) =>
      lower(s.name, s.address, s.provider_name, s.customer_name, s.deal_type, groupOf.get(s.group_id ?? "")?.name, statusOf.get(s.status_id)?.name),
    summary: (rows) => [formatMw(sum(rows, (s) => s.total_it_mw)), ...moneyTotals(rows)].join(" · "),
    filters: [
      {
        key: "status",
        label: "Filter by status",
        all: "All statuses",
        options: (rows) => {
          const used = new Set(rows.map((s) => s.status_id));
          return statuses.filter((status) => used.has(status.id)).map((status) => ({ value: status.id, label: status.name }));
        },
        test: (s, value) => s.status_id === value,
      },
      {
        key: "group",
        label: "Filter by group",
        all: "All groups",
        options: (rows) => {
          const used = new Set(rows.map((s) => s.group_id));
          return groups.filter((group) => used.has(group.id)).map((group) => ({ value: group.id, label: group.name }));
        },
        test: (s, value) => s.group_id === value,
        sidebar: true,
      },
    ],
    sections: {
      of: (s) => {
        const status = statusOf.get(s.status_id);
        return status ? { key: status.id, label: status.name, order: status.position } : { key: "", label: "No status", order: Infinity };
      },
    },
    columns: [
      {
        key: "name",
        header: "Site",
        width: "minmax(0, 2fr)",
        sortValue: (s) => s.name.toLowerCase(),
        render: (s) => <Primary name={s.name} sub={s.address} shape="square" active={s.active} />,
        total: () => <span className={styles.totalLabel}>Total</span>,
      },
      {
        key: "provider",
        header: "Provider",
        width: "minmax(0, 1.2fr)",
        wideOnly: true,
        sortValue: (s) => s.provider_name?.toLowerCase() ?? null,
        render: (s) => s.provider_name,
      },
      {
        key: "group",
        header: "Group",
        width: "minmax(0, 1fr)",
        sortValue: (s) => groupOf.get(s.group_id ?? "")?.position ?? null,
        render: (s) => {
          const group = groupOf.get(s.group_id ?? "");
          return group ? <Badge>{group.name}</Badge> : null;
        },
      },
      {
        key: "total",
        header: "Total IT",
        width: "92px",
        align: "end",
        sortValue: (s) => s.total_it_mw,
        render: (s) => formatMw(s.total_it_mw),
        total: (rows) => formatMw(sum(rows, (s) => s.total_it_mw)),
      },
      {
        key: "rfs",
        header: "RFS",
        width: "92px",
        align: "end",
        wideOnly: true,
        sortValue: (s) => s.rfs_date,
        render: (s) => formatDate(s.rfs_date),
      },
    ],
  };
}

export const NEW_LABELS: Record<RecordKind, string> = {
  people: "New person",
  companies: "New company",
  opportunities: "New opportunity",
  sites: "New site",
};

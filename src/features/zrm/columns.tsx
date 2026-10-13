import type { ReactNode } from "react";
import { Avatar, Badge, Icon, TypeBadges } from "./bits";
import {
  formatMoney,
  personName,
  type CompanyRow,
  type OpportunityRow,
  type PersonRow,
  type ZrmKind,
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
}

export interface ListConfig<T> {
  columns: readonly Column<T>[];
  /** Lower-cased text the search box matches against. */
  searchText: (row: T) => string;
  noun: [singular: string, plural: string];
  summary?: (rows: readonly T[]) => string;
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

const lower = (...parts: (string | null | undefined)[]): string => parts.filter(Boolean).join(" ").toLowerCase();

export function peopleConfig(types: Types): ListConfig<PersonRow> {
  return {
    noun: ["person", "people"],
    searchText: (p) => lower(personName(p), p.title, p.email, p.company_name),
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

export function opportunitiesConfig(): ListConfig<OpportunityRow> {
  return {
    noun: ["opportunity", "opportunities"],
    searchText: (o) => lower(o.title, o.person_name, o.company_name, o.stage_name),
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

export const NEW_LABELS: Record<ZrmKind, string> = {
  people: "New person",
  companies: "New company",
  opportunities: "New opportunity",
};

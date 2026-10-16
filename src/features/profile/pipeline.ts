import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ZRM_TAGS } from "@/features/zrm/queries";
import { DB_TAG, db } from "@/lib/db";

export interface PipelineFigure {
  readonly label: string;
  readonly sites: number;
  /** Total IT, in MW. */
  readonly mw: number;
}

/** The profile's cards: every site, then its capacity statuses in three groups, furthest along first. */
const GROUPS = [
  { label: "Contracted or closed", statuses: ["Contracted", "Closed"] },
  { label: "Under LOI", statuses: ["LOI"] },
  { label: "Negotiation or prospect", statuses: ["Negotiation", "Prospect"] },
] as const;

/**
 * The capacity pipeline as the team dashboard counts it, from the sites in
 * Capacity: the whole pipeline's sites and total IT, then each group's.
 * A site saved in Capacity refreshes it at once through the sites' tag; the
 * import scripts' writes show within the hour.
 */
export async function getCapacityPipeline(): Promise<readonly PipelineFigure[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(ZRM_TAGS.sites, DB_TAG);
  const rows = await db()`
    select st.name as status, count(*)::int as sites, coalesce(sum(s.total_it_mw), 0)::float8 as mw
    from capacity_sites s
    left join capacity_statuses st on st.id = s.status_id
    group by st.name
  `;
  const sum = (statuses?: readonly string[]): Omit<PipelineFigure, "label"> =>
    rows
      .filter((row) => !statuses || statuses.includes(String(row.status)))
      .reduce<Omit<PipelineFigure, "label">>(
        (total, row) => ({ sites: total.sites + Number(row.sites), mw: total.mw + Number(row.mw) }),
        { sites: 0, mw: 0 },
      );
  return [{ label: "Total pipeline", ...sum() }, ...GROUPS.map(({ label, statuses }) => ({ label, ...sum(statuses) }))];
}

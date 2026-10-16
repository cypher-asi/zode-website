import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import {
  formatCount,
  formatDay,
  formatDeposit,
  formatMw,
  formatRate,
  formatTb,
  formatLeaseYears,
  formatTerm,
  formatUsd,
} from "./format";
import { RolloutGantt } from "./RolloutGantt";
import {
  coolingLabel,
  creditLabel,
  facilityLabel,
  networkingLabel,
  platformBreakdown,
  platformSummary,
  rackDesignHref,
  totalsOf,
  type Deployment,
} from "./types";
import styles from "./deployments.module.css";

const yesNo = (value: boolean): string => (value ? "Yes" : "No");

function Facts({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className={styles.block} aria-label={title}>
      <h2 className={styles.blockTitle}>{title}</h2>
      <dl className={styles.facts}>{children}</dl>
    </section>
  );
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }): ReactElement {
  return (
    <div className={styles.fact} data-wide={wide ? "" : undefined}>
      <dt>{label}</dt>
      <dd>{children ?? <span className={styles.muted}>—</span>}</dd>
    </div>
  );
}

/** Everything about one deployment: headline figures, the build, its rollout, the commercial terms and credit. */
export function DeploymentDetail({ deployment: d, today }: { deployment: Deployment; today: string }): ReactElement {
  const totals = totalsOf(d);
  const next = d.phases.find((phase) => phase.rfsOn >= today);
  const rackHref = rackDesignHref(d);

  return (
    <div className={styles.detail}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatCount(totals.gpus)}</span>
          <span className={styles.statLabel}>{platformSummary(totals.byPlatform)} GPUs</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatCount(d.nodes)}</span>
          <span className={styles.statLabel}>Nodes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totals.mw ? formatMw(totals.mw) : "—"}</span>
          <span className={styles.statLabel}>Across the rollout</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{next ? formatDay(next.rfsOn) : "—"}</span>
          <span className={styles.statLabel}>{next ? "Next RFS" : "No RFS to come"}</span>
        </div>
      </div>

      <Facts title="Deployment">
        <Fact label="Platform">{platformSummary(totals.byPlatform)}</Fact>
        <Fact label="Nodes">{formatCount(d.nodes)}</Fact>
        <Fact label="Total GPUs">
          {formatCount(totals.gpus)}
          {totals.byPlatform.length > 1 ? (
            <span className={styles.muted}> · {platformBreakdown(totals.byPlatform)}</span>
          ) : null}
        </Fact>
        <Fact label="Cooling">{coolingLabel(d.cooling)}</Fact>
        <Fact label="Networking">{networkingLabel(d.networking)}</Fact>
        <Fact label="Storage">
          {d.storageTbPerNode ? (
            <>
              {formatTb(d.storageTbPerNode)} per node · {formatTb(totals.storageTb)} total
            </>
          ) : (
            "None"
          )}
        </Fact>
        <Fact label="Rack design">
          {rackHref ? (
            <Link className={styles.link} href={rackHref} prefetch={false}>
              Open in the cluster builder
            </Link>
          ) : (
            "Not in the cluster builder yet"
          )}
        </Fact>
        <Fact label="Facility">{facilityLabel(d.facility)}</Fact>
        <Fact label="City">{d.city}</Fact>
        <Fact label="Data room">
          {d.dataRoomId ? (
            <Link className={styles.link} href={`/portal/data-rooms/${d.dataRoomId}`} prefetch={false}>
              {d.dataRoomName}
            </Link>
          ) : null}
        </Fact>
        <Fact label="Data center address" wide>
          {d.address ? <span className={styles.preline}>{d.address}</span> : null}
        </Fact>
      </Facts>

      <section className={styles.block} aria-label="Rollout">
        <h2 className={styles.blockTitle}>Rollout</h2>
        {totals.scheduledNodes !== d.nodes && d.phases.length ? (
          <p className={styles.muted}>
            {formatCount(totals.scheduledNodes)} of {formatCount(d.nodes)} nodes scheduled.
          </p>
        ) : null}
        <RolloutGantt phases={d.phases} today={today} />
      </section>

      <Facts title="Commercial">
        <Fact label="Term">{d.termMonths !== null ? formatTerm(d.termMonths) : null}</Fact>
        <Fact label="Price">{d.priceGpuHr !== null ? formatRate(d.priceGpuHr) : null}</Fact>
        <Fact label="Deposit">{formatDeposit(d.depositUsd, d.depositPct)}</Fact>
        <Fact label="Est. monthly">{totals.monthlyUsd !== null ? formatUsd(totals.monthlyUsd) : null}</Fact>
        <Fact label="Est. contract value">{totals.contractUsd !== null ? formatUsd(totals.contractUsd) : null}</Fact>
      </Facts>

      <Facts title="Credit">
        <Fact label="Credit">{creditLabel(d.creditRating)}</Fact>
        <Fact label="LOC required">
          {d.locRequired ? `Yes${d.locYears !== null ? ` · ${formatLeaseYears(d.locYears)}` : ""}` : "No"}
        </Fact>
        <Fact label="Credit guarantee">{yesNo(d.creditGuarantee)}</Fact>
        <Fact label="Lease guarantee">{yesNo(d.leaseGuarantee)}</Fact>
      </Facts>

      {d.externalNotes ? (
        <section className={styles.block} aria-label="External notes">
          <h2 className={styles.blockTitle}>External notes</h2>
          <p className={styles.notes}>{d.externalNotes}</p>
        </section>
      ) : null}

      {d.notes ? (
        <section className={styles.block} aria-label="Internal notes">
          <h2 className={styles.blockTitle}>Internal notes</h2>
          <p className={styles.notes}>{d.notes}</p>
        </section>
      ) : null}
    </div>
  );
}

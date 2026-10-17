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
import { phaseLabel } from "./bom/phase";
import { valueLabel, type ConfigField, type ConfigGroup, type ResolvedConfig } from "./config/catalog";
import { fieldsFor, overrideLabels, resolveConfig } from "./config/resolve";
import { RolloutGantt } from "./RolloutGantt";
import {
  creditLabel,
  facilityLabel,
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

const BULLET = /^[-*•]\s+/;

/**
 * Notes as typed: blank lines separate blocks, and a block of lines starting
 * with "- " is a list, under a heading when one line leads it. Other blocks
 * keep their line breaks.
 */
function Notes({ text }: { text: string }): ReactElement {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length);
  return (
    <div className={styles.notes}>
      {blocks.map((lines, i) => {
        const lead = BULLET.test(lines[0]) ? null : lines[0];
        const items = lead === null ? lines : lines.slice(1);
        if (!items.length || !items.every((line) => BULLET.test(line))) return <p key={i}>{lines.join("\n")}</p>;
        return (
          <div key={i} className={styles.notesGroup}>
            {lead === null ? null : <h3>{lead}</h3>}
            <ul>
              {items.map((line, j) => (
                <li key={j}>{line.replace(BULLET, "")}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The configuration's sections after Platform, which takes the compute group. */
const SECTIONS: readonly { title: string; groups: readonly ConfigGroup[] }[] = [
  { title: "Networking", groups: ["fabric", "optics", "network"] },
  { title: "Storage", groups: ["storage"] },
  { title: "Racks, power and cooling", groups: ["rack"] },
  { title: "Management and software", groups: ["management"] },
  { title: "Services and support", groups: ["services"] },
];

/** The configuration's facts of `groups`, then each phase's overrides of them. */
function ConfigFacts({
  deployment: d,
  config,
  groups,
}: {
  deployment: Deployment;
  config: ResolvedConfig;
  groups: readonly ConfigGroup[];
}): ReactElement {
  const fields = fieldsFor(config).filter((f) => groups.includes(f.group) && f.key !== "nvmeDriveTb");
  return (
    <>
      {fields.map((f) => (
        <Fact key={f.key} label={f.key === "nvmeDrives" ? "Local NVMe" : f.label}>
          {configValue(d, config, f)}
        </Fact>
      ))}
      {d.phases.map((phase, i) => {
        const labels = overrideLabels(phase.configOverrides, resolveConfig(d, phase), groups);
        return labels.length ? (
          <Fact key={phase.id} label={`${phaseLabel(phase, i)} overrides`} wide>
            {labels.join(" · ")}
          </Fact>
        ) : null;
      })}
    </>
  );
}

function configValue(d: Deployment, config: ResolvedConfig, f: ConfigField): ReactNode {
  if (f.key === "nvmeDrives") return `${config.nvmeDrives} x ${valueLabel("nvmeDriveTb", config.nvmeDriveTb)} per node`;
  if (f.key !== "storageTbPerNode") return valueLabel(f.key, config[f.key]);
  if (!d.storageTbPerNode) return "None";
  return (
    <>
      {formatTb(d.storageTbPerNode)} per node · {formatTb(totalsOf(d).storageTb)} total
    </>
  );
}

/** Everything about one deployment: headline figures, the site, how it's built, its rollout, the commercial terms and credit. */
export function DeploymentDetail({ deployment: d, today }: { deployment: Deployment; today: string }): ReactElement {
  const totals = totalsOf(d);
  const next = d.phases.find((phase) => phase.rfsOn >= today);
  const rackHref = rackDesignHref(d);
  const config = resolveConfig(d);

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

      <Facts title="Site">
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

      <Facts title="Platform">
        <Fact label="Platform">{platformSummary(totals.byPlatform)}</Fact>
        <Fact label="Nodes">{formatCount(d.nodes)}</Fact>
        <Fact label="Total GPUs">
          {formatCount(totals.gpus)}
          {totals.byPlatform.length > 1 ? (
            <span className={styles.muted}> · {platformBreakdown(totals.byPlatform)}</span>
          ) : null}
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
        <ConfigFacts deployment={d} config={config} groups={["compute"]} />
      </Facts>

      {SECTIONS.map((section) => (
        <Facts key={section.title} title={section.title}>
          <ConfigFacts deployment={d} config={config} groups={section.groups} />
        </Facts>
      ))}

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
          <Notes text={d.externalNotes} />
        </section>
      ) : null}

      {d.notes ? (
        <section className={styles.block} aria-label="Internal notes">
          <h2 className={styles.blockTitle}>Internal notes</h2>
          <Notes text={d.notes} />
        </section>
      ) : null}
    </div>
  );
}

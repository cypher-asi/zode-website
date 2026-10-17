"use client";

import {
  startTransition,
  useActionState,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { deleteDeploymentAction, saveDeploymentAction, type DeploymentFormState } from "./actions";
import { AddressField } from "./AddressField";
import {
  CONFIG_GROUPS,
  DEFAULT_CONFIG,
  optionOf,
  valueLabel,
  type ColumnConfig,
  type ConfigField,
  type ConfigOverrides,
  type DeploymentConfig,
  type ResolvedConfig,
} from "./config/catalog";
import { fieldsFor, resolveConfig, type ConfigSource } from "./config/resolve";
import { phaseMw, phaseNodesForMw } from "./bom/phase";
import { formatCount, formatMw, formatTb, formatUsd } from "./format";
import {
  CREDIT_RATINGS,
  FACILITIES,
  PLATFORM_OPTIONS,
  STATUSES,
  gpusFor,
  isOption,
  mwFor,
  platformBreakdown,
  platformLabel,
  totalsOf,
  type Deployment,
  type Phase,
  type Platform,
  type RoomChoice,
} from "./types";
import styles from "./deployments.module.css";

const INITIAL: DeploymentFormState = {};

const NONE = { value: "", label: "Not set" };
const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

type Settings = DeploymentConfig & ColumnConfig;

const settingsOf = (d?: Deployment): Settings =>
  d
    ? { ...d.configuration, cooling: d.cooling, networking: d.networking, storageTbPerNode: d.storageTbPerNode }
    : { ...DEFAULT_CONFIG, cooling: "liquid_dtc", networking: "infiniband", storageTbPerNode: 4 };

const sourceOf = (s: Settings, platform: Platform): ConfigSource => {
  const { cooling, networking, storageTbPerNode, ...configuration } = s;
  return { platform, cooling, networking, storageTbPerNode, configuration };
};

/** What settings `s` on `platform` build, as a phase with `overrides` would. */
const resolvedOf = (s: Settings, platform: Platform, overrides?: ConfigOverrides): ResolvedConfig =>
  resolveConfig(sourceOf(s, platform), overrides ? { platform, configOverrides: overrides } : null);

const choicesOf = (f: ConfigField) => f.options.map((option) => ({ value: String(option.value), label: option.label }));

/** A setting typed in as a number (`ConfigField.range`), kept as typed until it's left, e.g. "2." on the way to "2.5". */
function RangeSetting({
  f,
  value,
  onChange,
  ...props
}: {
  f: ConfigField;
  value: unknown;
  onChange: (raw: string) => void;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-labelledby" | "aria-label" | "placeholder">): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const range = f.range!;
  return (
    <input
      {...props}
      className={ui.input}
      type="number"
      inputMode="decimal"
      min={range.min}
      max={range.max}
      step="any"
      value={draft ?? (value === undefined ? "" : String(value))}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

interface PhaseDraft {
  key: number;
  /** Empty for a phase added here. */
  id: string;
  name: string;
  platform: Platform;
  startOn: string;
  rfsOn: string;
  nodes: string;
  mw: string;
  /** Whether its MW was entered, so its nodes follow it; otherwise its MW follows its nodes. */
  mwSet: boolean;
  overrides: ConfigOverrides;
  /** Its terms, blank for to follow. */
  price: string;
  term: string;
  deposit: string;
}

const numberOr = (raw: string, fallback: number | null): number | null => {
  const value = Number(raw.replace(/[$,\s]/g, ""));
  return raw.trim() && Number.isFinite(value) ? value : fallback;
};

const str = (value: number | null): string => (value === null ? "" : String(value));

/** The row with its nodes following its MW when that was entered, otherwise its MW following its nodes, under settings `s`. */
const sized = (row: PhaseDraft, s: Settings): PhaseDraft => {
  const source = sourceOf(s, row.platform);
  const phase = { platform: row.platform, configOverrides: row.overrides };
  const mw = numberOr(row.mw, null);
  if (row.mwSet) return mw === null ? row : { ...row, nodes: str(phaseNodesForMw(source, phase, mw)) };
  const nodes = numberOr(row.nodes, null);
  return { ...row, mw: nodes === null ? "" : str(phaseMw(source, { ...phase, nodes })) };
};

/** `after` under settings `s1`, sized as `before` was under `s0`: nodes cut below what its MW powers stay cut. */
const resized = (before: PhaseDraft, s0: Settings, after: PhaseDraft, s1: Settings): PhaseDraft =>
  before.mwSet && before.nodes !== sized(before, s0).nodes ? after : sized(after, s1);

type Terms = Pick<Phase, "priceGpuHr" | "termMonths" | "depositPct">;

/**
 * A saved phase, or a new one, with any terms it leaves unset taken from
 * `fallback`. Its MW counts as entered unless it's what its nodes draw, alone
 * or with what's built around them under settings `s`.
 */
const draftOf = (key: number, platform: Platform, s: Settings, phase?: Phase, fallback?: Terms): PhaseDraft => {
  const row: PhaseDraft = {
    key,
    id: phase?.id ?? "",
    name: phase?.name ?? "",
    platform: phase?.platform ?? platform,
    startOn: phase?.startOn ?? "",
    rfsOn: phase?.rfsOn ?? "",
    nodes: phase ? String(phase.nodes) : "",
    mw: str(phase?.mw ?? null),
    mwSet: false,
    overrides: phase?.configOverrides ?? {},
    price: str(phase?.priceGpuHr ?? fallback?.priceGpuHr ?? null),
    term: str(phase?.termMonths ?? fallback?.termMonths ?? null),
    deposit: str(phase?.depositPct ?? fallback?.depositPct ?? null),
  };
  if (!phase || phase.mw === null) return row;
  const derived = sized(row, s);
  return phase.mw === mwFor(phase.platform, phase.nodes) || derived.mw === row.mw ? derived : { ...row, mwSet: true };
};

const scheduledOf = (rows: readonly PhaseDraft[]): number =>
  rows.reduce((sum, row) => sum + numberOr(row.nodes, 0)!, 0);

/**
 * The terms deployment `d` was saved with before they were set by phase, for
 * its phases to start from; the deposit's percent worked out from the amount
 * for those saved before it was entered as one.
 */
const legacyTermsOf = (d: Deployment): Terms => {
  const { contractUsd } = totalsOf(d);
  const depositPct =
    d.depositPct !== null || d.depositUsd === null
      ? d.depositPct
      : contractUsd
        ? Math.round((d.depositUsd / contractUsd) * 10_000) / 100
        : null;
  return { priceGpuHr: d.priceGpuHr, termMonths: d.termMonths, depositPct };
};

const NO_TERMS: Terms = { priceGpuHr: null, termMonths: null, depositPct: null };

/** A field with its unit inside it, e.g. "$" before a price or "%" after a deposit. */
function Affixed({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: ReactNode }): ReactElement {
  return (
    <span
      className={styles.affix}
      data-prefix={prefix ? "" : undefined}
      data-suffix={suffix ? "" : undefined}
      style={suffix ? ({ "--suffix": `${suffix.length}ch` } as CSSProperties) : undefined}
    >
      {prefix ? (
        <span className={styles.prefix} aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      {children}
      {suffix ? (
        <span className={styles.suffix} aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Adds a deployment, or edits `deployment`, for the ZODE team, linked to one
 * of `rooms` if they choose. Totals follow the figures as they're typed. Its
 * configuration, which each phase can override, sets what its BOM needs.
 */
export function DeploymentForm({
  deployment,
  rooms,
}: {
  deployment?: Deployment;
  rooms: readonly RoomChoice[];
}): ReactElement {
  const id = useId();
  const d = deployment;
  const [state, action, saving] = useActionState(saveDeploymentAction, INITIAL);
  const [settings, setSettings] = useState<Settings>(() => settingsOf(d));
  const [loc, setLoc] = useState(d?.locRequired ? "yes" : "no");
  const [phases, setPhases] = useState<PhaseDraft[]>(() => {
    const legacy = d ? legacyTermsOf(d) : undefined;
    return d?.phases.length
      ? d.phases.map((phase, key) => draftOf(key, d.platform, settings, phase, legacy))
      : [draftOf(0, d?.platform ?? "b300", settings, undefined, legacy)];
  });
  const nextKey = useRef(phases.length);
  const [deleting, setDeleting] = useState(false);

  const platform = phases[0]?.platform ?? d?.platform ?? "b300";
  const nodeCount = scheduledOf(phases);
  const pricedPhases = phases.map((phase) => ({
    platform: phase.platform,
    nodes: numberOr(phase.nodes, 0)!,
    mw: numberOr(phase.mw, null),
    priceGpuHr: numberOr(phase.price, null),
    termMonths: numberOr(phase.term, null),
    depositPct: numberOr(phase.deposit.replace(/%$/, ""), null),
  }));
  const totals = totalsOf({
    nodes: nodeCount,
    platform,
    storageTbPerNode: settings.storageTbPerNode,
    ...NO_TERMS,
    phases: pricedPhases,
  });
  const allMw = totals.byPlatform.reduce(
    (sum, share) =>
      sum + phaseMw(sourceOf(settings, share.platform), { platform: share.platform, nodes: share.nodes, configOverrides: {} }),
    0,
  );
  const scheduledGpus = phases.reduce((sum, phase) => sum + gpusFor(phase.platform, numberOr(phase.nodes, 0)!), 0);
  const resolved = resolvedOf(settings, platform);
  const fields = fieldsFor(resolved);
  const roomChoices = [
    { value: "", label: "Not linked" },
    ...rooms.map((room) => ({ value: room.id, label: room.name })),
  ];

  const updatePhase = (key: number, patch: Partial<PhaseDraft>) =>
    setPhases(
      phases.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if ("mw" in patch) next.mwSet = next.mw.trim() !== "";
        const follows = "platform" in patch || (next.mwSet ? "mw" in patch : "nodes" in patch);
        return follows ? sized(next, settings) : next;
      }),
    );

  const setSetting = (f: ConfigField, raw: string) => {
    const value = optionOf(f, raw);
    if (value === undefined) return;
    const next: Settings = {
      ...settings,
      [f.key]: value,
      ...(f.key === "cooling" ? { density: value === "air" ? 4 : 8 } : {}),
    };
    setSettings(next);
    setPhases(phases.map((row) => resized(row, settings, row, next)));
  };

  const setOverride = (key: number, f: ConfigField, raw: string) =>
    setPhases(
      phases.map((row) => {
        if (row.key !== key) return row;
        const overrides: ConfigOverrides = { ...row.overrides };
        const value = raw === "" ? undefined : optionOf(f, raw);
        if (raw !== "" && value === undefined) return row;
        if (value === undefined) delete overrides[f.key];
        else (overrides as Record<string, unknown>)[f.key] = value;
        return resized(row, settings, { ...row, overrides }, settings);
      }),
    );

  // Submitted by hand so a rejected save keeps everything typed.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };

  const label = (key: string, text: string) => (
    <label id={`${id}-${key}-label`} htmlFor={`${id}-${key}`} className={ui.label}>
      {text}
    </label>
  );

  const select = (
    key: string,
    text: string,
    options: readonly { value: string; label: string }[],
    defaultValue: string,
  ) => (
    <div className={ui.field}>
      {label(key, text)}
      <Select
        id={`${id}-${key}`}
        aria-labelledby={`${id}-${key}-label`}
        name={key}
        className={ui.fill}
        options={options}
        defaultValue={defaultValue}
      />
    </div>
  );

  const input = (key: string, text: string, props: InputHTMLAttributes<HTMLInputElement>) => (
    <div className={ui.field}>
      {label(key, text)}
      <input id={`${id}-${key}`} name={key} className={ui.input} {...props} />
    </div>
  );

  const section = (title: string, children: ReactNode, aside?: ReactNode) => (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{title}</legend>
      {aside}
      <div className={styles.grid}>{children}</div>
    </fieldset>
  );

  return (
    <>
      <form className={styles.form} onSubmit={submit}>
        {d ? <input type="hidden" name="id" value={d.id} /> : null}

        {section(
          "Deployment",
          <>
            <div className={ui.field} data-wide="">
              {label("name", "Name *")}
              <input
                id={`${id}-name`}
                name="name"
                className={ui.input}
                defaultValue={d?.name}
                required
                maxLength={200}
                placeholder="e.g. Acme · Dallas 1"
              />
            </div>
            {select("status", "Status", STATUSES, d?.status ?? "active")}
            {select("facility", "Facility", [NONE, ...FACILITIES], d?.facility ?? "")}
            {select("data_room_id", "Data room", roomChoices, d?.dataRoomId ?? "")}
            <AddressField address={d?.address ?? null} city={d?.city ?? null} placeId={d?.placeId ?? null} />
          </>,
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Configuration</legend>
          <input type="hidden" name="configuration" value={JSON.stringify(settings)} />
          <p className={styles.summary}>
            {totals.byPlatform.length > 1
              ? `${formatCount(totals.gpus)} GPUs (${platformBreakdown(totals.byPlatform)})`
              : `${formatCount(totals.gpus)} GPUs`}{" "}
            · {totals.storageTb ? `${formatTb(totals.storageTb)} storage` : "No storage"}
            {allMw ? ` · Est. ${formatMw(allMw)} IT` : ""}. Each phase builds to this unless it overrides it, and its
            BOM needs what it sets. Platform, nodes and compute are set by phase in the rollout.
          </p>
          {CONFIG_GROUPS.filter((group) => group.id !== "compute").map((group) => {
            const groupFields = fields.filter((f) => f.group === group.id);
            return (
              <div key={group.id} className={styles.configGroup}>
                <h3 className={styles.configHead}>{group.label}</h3>
                <div className={styles.grid}>
                  {groupFields.map((f) => (
                    <div key={f.key} className={ui.field}>
                      {label(`config-${f.key}`, f.range ? `${f.label} (${f.range.unit})` : f.label)}
                      {f.range ? (
                        <RangeSetting
                          f={f}
                          id={`${id}-config-${f.key}`}
                          aria-labelledby={`${id}-config-${f.key}-label`}
                          placeholder="0"
                          value={settings[f.key]}
                          onChange={(value) => setSetting(f, value || "0")}
                        />
                      ) : (
                        <Select
                          id={`${id}-config-${f.key}`}
                          aria-labelledby={`${id}-config-${f.key}-label`}
                          className={ui.fill}
                          options={choicesOf(f)}
                          value={String(settings[f.key])}
                          onChange={(value) => setSetting(f, value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Rollout</legend>
          <p className={styles.summary}>
            {formatCount(nodeCount)} nodes · {formatCount(scheduledGpus)} GPUs
            {totals.mw ? ` · ${totals.mw.toLocaleString("en-US", { maximumFractionDigits: 2 })} MW` : ""}. A
            phase&apos;s IT MW sets its nodes, as many as it powers with their network, storage and management;
            change the nodes to build fewer.
          </p>
          <div className={styles.phases}>
            <div className={styles.phaseHead} aria-hidden="true">
              <span>Phase</span>
              <span>Platform</span>
              <span>Start</span>
              <span>RFS *</span>
              <span>IT MW</span>
              <span>Nodes *</span>
              <span data-num="">GPUs</span>
              <span />
            </div>
            {phases.map((phase, i) => {
              const phaseConfig = resolvedOf(settings, phase.platform, phase.overrides);
              const phaseFields = fieldsFor(phaseConfig);
              const overridden = phaseFields.filter((f) => f.key in phase.overrides).length;
              return (
              <div key={phase.key} className={styles.phase}>
              <div className={styles.phaseRow}>
                <input type="hidden" name="phase_id" value={phase.id} />
                <input type="hidden" name="phase_config" value={JSON.stringify(phase.overrides)} />
                <input
                  name="phase_name"
                  className={ui.input}
                  aria-label={`Phase ${i + 1} name`}
                  placeholder={`Phase ${i + 1}`}
                  maxLength={200}
                  value={phase.name}
                  onChange={(event) => updatePhase(phase.key, { name: event.target.value })}
                />
                <Select
                  name="phase_platform"
                  className={ui.fill}
                  aria-label={`Phase ${i + 1} platform`}
                  options={PLATFORM_OPTIONS}
                  value={phase.platform}
                  onChange={(value) => {
                    if (isOption(PLATFORM_OPTIONS, value)) updatePhase(phase.key, { platform: value });
                  }}
                />
                <input
                  name="phase_start_on"
                  type="date"
                  className={ui.input}
                  aria-label={`Phase ${i + 1} start`}
                  value={phase.startOn}
                  onChange={(event) => updatePhase(phase.key, { startOn: event.target.value })}
                />
                <input
                  name="phase_rfs_on"
                  type="date"
                  className={ui.input}
                  aria-label={`Phase ${i + 1} RFS date`}
                  value={phase.rfsOn}
                  onChange={(event) => updatePhase(phase.key, { rfsOn: event.target.value })}
                />
                <input
                  name="phase_mw"
                  className={ui.input}
                  inputMode="decimal"
                  aria-label={`Phase ${i + 1} IT MW`}
                  placeholder="0"
                  value={phase.mw}
                  onChange={(event) => updatePhase(phase.key, { mw: event.target.value })}
                />
                <input
                  name="phase_nodes"
                  className={ui.input}
                  inputMode="numeric"
                  aria-label={`Phase ${i + 1} nodes`}
                  placeholder="0"
                  value={phase.nodes}
                  onChange={(event) => updatePhase(phase.key, { nodes: event.target.value })}
                />
                <span className={styles.phaseGpus}>
                  {formatCount(gpusFor(phase.platform, numberOr(phase.nodes, 0)!))}
                </span>
                <button
                  type="button"
                  className={ui.iconButton}
                  aria-label={`Remove phase ${i + 1}`}
                  disabled={phases.length === 1}
                  onClick={() => setPhases(phases.filter((row) => row.key !== phase.key))}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
              <details className={styles.overrides}>
                <summary>
                  {overridden
                    ? `Configuration · ${overridden} setting${overridden === 1 ? "" : "s"} changed from the default`
                    : "Configuration · default"}
                </summary>
                <div className={styles.grid}>
                  {phaseFields.map((f) => (
                    <div key={f.key} className={ui.field}>
                      <span className={ui.label}>{f.range ? `${f.label} (${f.range.unit})` : f.label}</span>
                      {f.range ? (
                        <RangeSetting
                          f={f}
                          aria-label={`Phase ${i + 1} ${f.label.toLowerCase()}`}
                          placeholder={`Default (${valueLabel(f.key, settings[f.key])})`}
                          value={phase.overrides[f.key]}
                          onChange={(value) => setOverride(phase.key, f, value)}
                        />
                      ) : (
                        <Select
                          className={ui.fill}
                          aria-label={`Phase ${i + 1} ${f.label.toLowerCase()}`}
                          options={[
                            { value: "", label: `Default (${valueLabel(f.key, settings[f.key])})` },
                            ...choicesOf(f),
                          ]}
                          value={f.key in phase.overrides ? String(phase.overrides[f.key]) : ""}
                          onChange={(value) => setOverride(phase.key, f, value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </details>
              </div>
              );
            })}
          </div>
          <div>
            <button
              type="button"
              className={ui.button}
              onClick={() => {
                const key = nextKey.current++;
                setPhases((rows) => [...rows, { ...draftOf(key, platform, settings), overrides: { ...rows[0]?.overrides } }]);
              }}
            >
              Add phase
            </button>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Commercial</legend>
          <p className={styles.summary}>
            {totals.monthlyUsd !== null
              ? [
                  `Est. ${formatUsd(totals.monthlyUsd)} /mo`,
                  totals.contractUsd !== null ? `${formatUsd(totals.contractUsd)} over the terms` : null,
                  totals.depositUsd !== null ? `${formatUsd(totals.depositUsd)} deposit` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Price a phase to estimate revenue"}
            . Each phase is priced on its own; one without a price is to follow.
          </p>
          <div className={styles.phases}>
            <div className={styles.pricingHead} aria-hidden="true">
              <span>Phase</span>
              <span>Platform</span>
              <span data-num="">GPUs</span>
              <span>Term</span>
              <span>Price</span>
              <span>Deposit</span>
            </div>
            {phases.map((phase, i) => (
              <div key={phase.key} className={styles.pricingRow}>
                <span className={styles.pricingName}>{phase.name || `Phase ${i + 1}`}</span>
                <span className={styles.pricingPlatform}>{platformLabel(phase.platform)}</span>
                <span className={styles.phaseGpus}>{formatCount(gpusFor(phase.platform, pricedPhases[i].nodes))}</span>
                <Affixed suffix="months">
                  <input
                    name="phase_term_months"
                    className={ui.input}
                    inputMode="numeric"
                    aria-label={`Phase ${i + 1} term in months`}
                    value={phase.term}
                    onChange={(event) => updatePhase(phase.key, { term: event.target.value })}
                  />
                </Affixed>
                <Affixed prefix="$" suffix="/GPU-hr">
                  <input
                    name="phase_price_gpu_hr"
                    className={ui.input}
                    inputMode="decimal"
                    aria-label={`Phase ${i + 1} price per GPU-hour`}
                    value={phase.price}
                    onChange={(event) => updatePhase(phase.key, { price: event.target.value })}
                  />
                </Affixed>
                <Affixed suffix="% of contract">
                  <input
                    name="phase_deposit_pct"
                    className={ui.input}
                    inputMode="decimal"
                    aria-label={`Phase ${i + 1} deposit percent of contract`}
                    value={phase.deposit}
                    onChange={(event) => updatePhase(phase.key, { deposit: event.target.value })}
                  />
                </Affixed>
              </div>
            ))}
          </div>
        </fieldset>

        {section(
          "Credit",
          <>
            {select("credit_rating", "Credit", [NONE, ...CREDIT_RATINGS], d?.creditRating ?? "")}
            <div className={ui.field}>
              {label("loc_required", "LOC required")}
              <Select
                id={`${id}-loc_required`}
                aria-labelledby={`${id}-loc_required-label`}
                name="loc_required"
                className={ui.fill}
                options={YES_NO}
                value={loc}
                onChange={setLoc}
              />
            </div>
            {loc === "yes"
              ? input("loc_years", "LOC (years of lease)", {
                  inputMode: "decimal",
                  placeholder: "1",
                  defaultValue: str(d?.locYears ?? null),
                })
              : null}
            {select("credit_guarantee", "Credit guarantee", YES_NO, d?.creditGuarantee ? "yes" : "no")}
            {select("lease_guarantee", "Lease guarantee", YES_NO, d?.leaseGuarantee ? "yes" : "no")}
          </>,
        )}

        {section(
          "Notes",
          <>
            <div className={ui.field} data-wide="">
              {label("external_notes", "External notes")}
              <textarea
                id={`${id}-external_notes`}
                name="external_notes"
                className={ui.textarea}
                rows={3}
                maxLength={5000}
                defaultValue={d?.externalNotes ?? ""}
              />
            </div>
            <div className={ui.field} data-wide="">
              {label("notes", "Internal notes")}
              <textarea
                id={`${id}-notes`}
                name="notes"
                className={ui.textarea}
                rows={3}
                maxLength={5000}
                defaultValue={d?.notes ?? ""}
              />
            </div>
          </>,
          <p className={styles.summary}>
            External notes show wherever the deployment does, its PDF and public link included. Internal notes stay in
            the portal.
          </p>,
        )}

        {state.error ? (
          <p className={ui.error} role="alert">
            {state.error}
          </p>
        ) : null}
        <div className={styles.actions}>
          {d ? (
            <button type="button" className={ui.danger} onClick={() => setDeleting(true)} data-start="">
              Delete
            </button>
          ) : null}
          <Link href={d ? `/portal/deployments/${d.id}` : "/portal/deployments"} className={ui.button}>
            Cancel
          </Link>
          <button type="submit" className={ui.primary} disabled={saving}>
            {saving ? "Saving…" : d ? "Save deployment" : "Add deployment"}
          </button>
        </div>
      </form>

      {deleting && d ? (
        <Dialog
          title={`Delete ${d.name}?`}
          description="It and its rollout are removed for everyone. This can't be undone."
          confirmLabel="Delete deployment"
          danger
          onConfirm={async () => (await deleteDeploymentAction(d.id)).error}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}

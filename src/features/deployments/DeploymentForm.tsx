"use client";

import {
  startTransition,
  useActionState,
  useId,
  useRef,
  useState,
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
import { formatCount, formatMw, formatTb, formatUsd } from "./format";
import {
  COOLING,
  CREDIT_RATINGS,
  FACILITIES,
  NETWORKING,
  PLATFORM_OPTIONS,
  STATUSES,
  STORAGE_OPTIONS,
  depositFor,
  gpusFor,
  isOption,
  mwFor,
  platformBreakdown,
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
const STORAGE_CHOICES = STORAGE_OPTIONS.map((tb) => ({ value: String(tb), label: tb ? `${tb} TB per node` : "None" }));

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
}

const numberOr = (raw: string, fallback: number | null): number | null => {
  const value = Number(raw.replace(/[$,\s]/g, ""));
  return raw.trim() && Number.isFinite(value) ? value : fallback;
};

const str = (value: number | null): string => (value === null ? "" : String(value));

const draftOf = (key: number, platform: Platform, phase?: Phase): PhaseDraft => ({
  key,
  id: phase?.id ?? "",
  name: phase?.name ?? "",
  platform: phase?.platform ?? platform,
  startOn: phase?.startOn ?? "",
  rfsOn: phase?.rfsOn ?? "",
  nodes: phase ? String(phase.nodes) : "",
  mw: str(phase?.mw ?? null),
});

/** The deposit's percent, worked out from the amount for deployments saved before it was entered as one. */
const depositPctOf = (d: Deployment): number | null => {
  if (d.depositPct !== null || d.depositUsd === null) return d.depositPct;
  const { contractUsd } = totalsOf(d);
  return contractUsd ? Math.round((d.depositUsd / contractUsd) * 10_000) / 100 : null;
};

/**
 * Adds a deployment, or edits `deployment`, for the ZODE team, linked to one
 * of `rooms` if they choose. Totals follow the figures as they're typed.
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
  const [nodes, setNodes] = useState(String(d?.nodes ?? 64));
  const [platform, setPlatform] = useState<Platform>(d?.platform ?? "b300");
  const [storage, setStorage] = useState(String(d?.storageTbPerNode ?? 4));
  const [price, setPrice] = useState(str(d?.priceGpuHr ?? null));
  const [term, setTerm] = useState(str(d?.termMonths ?? null));
  const [deposit, setDeposit] = useState(() => str(d ? depositPctOf(d) : null));
  const [loc, setLoc] = useState(d?.locRequired ? "yes" : "no");
  const [phases, setPhases] = useState<PhaseDraft[]>(() =>
    d?.phases.length
      ? d.phases.map((phase, key) => draftOf(key, d.platform, phase))
      : [draftOf(0, d?.platform ?? "b300")],
  );
  const nextKey = useRef(phases.length);
  const [deleting, setDeleting] = useState(false);

  const nodeCount = numberOr(nodes, 0)!;
  const totals = totalsOf({
    nodes: nodeCount,
    platform,
    storageTbPerNode: Number(storage),
    priceGpuHr: numberOr(price, null),
    termMonths: numberOr(term, null),
    phases: phases.map((phase) => ({
      platform: phase.platform,
      nodes: numberOr(phase.nodes, 0)!,
      mw: numberOr(phase.mw, null),
    })),
  });
  const allMw = totals.byPlatform.reduce((sum, share) => sum + mwFor(share.platform, share.nodes), 0);
  const depositPct = numberOr(deposit.replace(/%$/, ""), null);
  const depositUsd = depositFor(totals.contractUsd, depositPct);
  const roomChoices = [
    { value: "", label: "Not linked" },
    ...rooms.map((room) => ({ value: room.id, label: room.name })),
  ];

  const updatePhase = (key: number, patch: Partial<PhaseDraft>) =>
    setPhases((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if ("nodes" in patch || "platform" in patch) {
          const phaseNodes = numberOr(next.nodes, null);
          next.mw = phaseNodes === null ? "" : str(mwFor(next.platform, phaseNodes));
        }
        return next;
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
            <div className={ui.field}>
              {label("platform", "Platform")}
              <Select
                id={`${id}-platform`}
                aria-labelledby={`${id}-platform-label`}
                name="platform"
                className={ui.fill}
                options={PLATFORM_OPTIONS}
                value={platform}
                onChange={(value) => {
                  if (isOption(PLATFORM_OPTIONS, value)) setPlatform(value);
                }}
              />
            </div>
            {input("nodes", "Nodes (all platforms)", {
              inputMode: "numeric",
              placeholder: "64",
              required: true,
              value: nodes,
              onChange: (event) => setNodes(event.target.value),
            })}
            {select("cooling", "Cooling", COOLING, d?.cooling ?? "liquid_dtc")}
            {select("networking", "Networking", NETWORKING, d?.networking ?? "infiniband")}
            <div className={ui.field}>
              {label("storage_tb_per_node", "Storage")}
              <Select
                id={`${id}-storage_tb_per_node`}
                aria-labelledby={`${id}-storage_tb_per_node-label`}
                name="storage_tb_per_node"
                className={ui.fill}
                options={STORAGE_CHOICES}
                value={storage}
                onChange={setStorage}
              />
            </div>
            {select("facility", "Facility", [NONE, ...FACILITIES], d?.facility ?? "")}
            {select("data_room_id", "Data room", roomChoices, d?.dataRoomId ?? "")}
            <AddressField address={d?.address ?? null} city={d?.city ?? null} placeId={d?.placeId ?? null} />
          </>,
          <p className={styles.summary}>
            {totals.byPlatform.length > 1
              ? `${formatCount(totals.gpus)} GPUs (${platformBreakdown(totals.byPlatform)})`
              : `${formatCount(totals.gpus)} GPUs`}{" "}
            · {totals.storageTb ? `${formatTb(totals.storageTb)} storage` : "No storage"}
            {allMw ? ` · Est. ${formatMw(allMw)} IT` : ""}
          </p>,
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Rollout</legend>
          <p className={styles.summary} data-warn={totals.scheduledNodes > nodeCount ? "" : undefined}>
            {formatCount(totals.scheduledNodes)} of {formatCount(nodeCount)} nodes scheduled ·{" "}
            {formatCount(gpusFor(totals.scheduledNodes))} GPUs
            {totals.mw ? ` · ${totals.mw.toLocaleString("en-US", { maximumFractionDigits: 2 })} MW` : ""}
          </p>
          <div className={styles.phases}>
            <div className={styles.phaseHead} aria-hidden="true">
              <span>Phase</span>
              <span>Platform</span>
              <span>Start</span>
              <span>RFS *</span>
              <span>Nodes *</span>
              <span>MW</span>
              <span>GPUs</span>
              <span />
            </div>
            {phases.map((phase, i) => (
              <div key={phase.key} className={styles.phaseRow}>
                <input type="hidden" name="phase_id" value={phase.id} />
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
                  name="phase_nodes"
                  className={ui.input}
                  inputMode="numeric"
                  aria-label={`Phase ${i + 1} nodes`}
                  placeholder="0"
                  value={phase.nodes}
                  onChange={(event) => updatePhase(phase.key, { nodes: event.target.value })}
                />
                <input
                  name="phase_mw"
                  className={ui.input}
                  inputMode="decimal"
                  aria-label={`Phase ${i + 1} MW`}
                  placeholder="0"
                  value={phase.mw}
                  onChange={(event) => updatePhase(phase.key, { mw: event.target.value })}
                />
                <span className={styles.phaseGpus}>{formatCount(gpusFor(numberOr(phase.nodes, 0)!))}</span>
                <button
                  type="button"
                  className={ui.iconButton}
                  aria-label={`Remove phase ${i + 1}`}
                  onClick={() => setPhases((rows) => rows.filter((row) => row.key !== phase.key))}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div>
            <button
              type="button"
              className={ui.button}
              onClick={() => {
                const key = nextKey.current++;
                setPhases((rows) => [...rows, draftOf(key, platform)]);
              }}
            >
              Add phase
            </button>
          </div>
        </fieldset>

        {section(
          "Commercial",
          <>
            {input("term_months", "Term (months)", {
              inputMode: "numeric",
              placeholder: "36",
              value: term,
              onChange: (event) => setTerm(event.target.value),
            })}
            {input("price_gpu_hr", "Price ($ per GPU-hr)", {
              inputMode: "decimal",
              placeholder: "2.00",
              value: price,
              onChange: (event) => setPrice(event.target.value),
            })}
            {input("deposit_pct", "Deposit (% of contract)", {
              inputMode: "decimal",
              placeholder: "0",
              value: deposit,
              onChange: (event) => setDeposit(event.target.value),
            })}
          </>,
          <p className={styles.summary}>
            {totals.monthlyUsd !== null
              ? `Est. ${formatUsd(totals.monthlyUsd)} /mo`
              : "Add a price to estimate revenue"}
            {totals.contractUsd !== null ? ` · ${formatUsd(totals.contractUsd)} over the term` : ""}
            {depositUsd !== null
              ? ` · ${formatUsd(depositUsd)} deposit`
              : depositPct
                ? " · Add a price and term to calculate the deposit"
                : ""}
          </p>,
        )}

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
            External notes show wherever the deployment does, its public link included. Internal notes stay in the
            portal and the team&apos;s PDF.
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

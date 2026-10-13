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
import { formatCount, formatTb, formatUsd } from "./format";
import {
  COOLING,
  CREDIT_RATINGS,
  FACILITIES,
  NETWORKING,
  NODE_OPTIONS,
  PLATFORM_OPTIONS,
  STATUSES,
  STORAGE_OPTIONS,
  gpusFor,
  totalsOf,
  type Deployment,
  type Phase,
} from "./types";
import styles from "./deployments.module.css";

const INITIAL: DeploymentFormState = {};

const NONE = { value: "", label: "Not set" };
const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];
const NODE_CHOICES = NODE_OPTIONS.map((n) => ({
  value: String(n),
  label: `${n} nodes · ${formatCount(gpusFor(n))} GPUs`,
}));
const STORAGE_CHOICES = STORAGE_OPTIONS.map((tb) => ({ value: String(tb), label: tb ? `${tb} TB per node` : "None" }));

interface PhaseDraft {
  key: number;
  name: string;
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

const draftOf = (key: number, phase?: Phase): PhaseDraft => ({
  key,
  name: phase?.name ?? "",
  startOn: phase?.startOn ?? "",
  rfsOn: phase?.rfsOn ?? "",
  nodes: phase ? String(phase.nodes) : "",
  mw: str(phase?.mw ?? null),
});

/** Adds a deployment, or edits `deployment`, for the ZODE team. Totals follow the figures as they're typed. */
export function DeploymentForm({ deployment }: { deployment?: Deployment }): ReactElement {
  const id = useId();
  const d = deployment;
  const [state, action, saving] = useActionState(saveDeploymentAction, INITIAL);
  const [nodes, setNodes] = useState(String(d?.nodes ?? 64));
  const [storage, setStorage] = useState(String(d?.storageTbPerNode ?? 4));
  const [price, setPrice] = useState(str(d?.priceGpuHr ?? null));
  const [term, setTerm] = useState(str(d?.termMonths ?? null));
  const [loc, setLoc] = useState(d?.locRequired ? "yes" : "no");
  const [phases, setPhases] = useState<PhaseDraft[]>(() =>
    d?.phases.length ? d.phases.map((phase, key) => draftOf(key, phase)) : [draftOf(0)],
  );
  const nextKey = useRef(phases.length);
  const [deleting, setDeleting] = useState(false);

  const totals = totalsOf({
    nodes: Number(nodes),
    storageTbPerNode: Number(storage),
    priceGpuHr: numberOr(price, null),
    termMonths: numberOr(term, null),
    phases: phases.map((phase) => ({ nodes: numberOr(phase.nodes, 0)!, mw: numberOr(phase.mw, null) })),
  });

  const updatePhase = (key: number, patch: Partial<PhaseDraft>) =>
    setPhases((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

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
            {select("platform", "Platform", PLATFORM_OPTIONS, d?.platform ?? "b300")}
            <div className={ui.field}>
              {label("nodes", "Nodes")}
              <Select
                id={`${id}-nodes`}
                aria-labelledby={`${id}-nodes-label`}
                name="nodes"
                className={ui.fill}
                options={NODE_CHOICES}
                value={nodes}
                onChange={setNodes}
              />
            </div>
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
            <div className={ui.field} data-wide="">
              {label("address", "Data center address")}
              <textarea
                id={`${id}-address`}
                name="address"
                className={ui.textarea}
                rows={2}
                maxLength={500}
                defaultValue={d?.address ?? ""}
              />
            </div>
          </>,
          <p className={styles.summary}>
            {formatCount(totals.gpus)} GPUs ·{" "}
            {totals.storageTb ? `${formatTb(totals.storageTb)} storage` : "No storage"}
          </p>,
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Rollout</legend>
          <p className={styles.summary} data-warn={totals.scheduledNodes > Number(nodes) ? "" : undefined}>
            {formatCount(totals.scheduledNodes)} of {formatCount(Number(nodes))} nodes scheduled ·{" "}
            {formatCount(gpusFor(totals.scheduledNodes))} GPUs
            {totals.mw ? ` · ${totals.mw.toLocaleString("en-US", { maximumFractionDigits: 2 })} MW` : ""}
          </p>
          <div className={styles.phases}>
            <div className={styles.phaseHead} aria-hidden="true">
              <span>Phase</span>
              <span>Start</span>
              <span>RFS *</span>
              <span>Nodes *</span>
              <span>MW</span>
              <span>GPUs</span>
              <span />
            </div>
            {phases.map((phase, i) => (
              <div key={phase.key} className={styles.phaseRow}>
                <input
                  name="phase_name"
                  className={ui.input}
                  aria-label={`Phase ${i + 1} name`}
                  placeholder={`Phase ${i + 1}`}
                  maxLength={200}
                  value={phase.name}
                  onChange={(event) => updatePhase(phase.key, { name: event.target.value })}
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
                setPhases((rows) => [...rows, draftOf(key)]);
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
            {input("deposit_usd", "Deposit (USD)", {
              inputMode: "decimal",
              placeholder: "0",
              defaultValue: str(d?.depositUsd ?? null),
            })}
          </>,
          <p className={styles.summary}>
            {totals.monthlyUsd !== null
              ? `Est. ${formatUsd(totals.monthlyUsd)} /mo`
              : "Add a price to estimate revenue"}
            {totals.contractUsd !== null ? ` · ${formatUsd(totals.contractUsd)} over the term` : ""}
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
              ? input("loc_amount_usd", "LOC amount (USD)", {
                  inputMode: "decimal",
                  placeholder: "0",
                  defaultValue: str(d?.locAmountUsd ?? null),
                })
              : null}
            {select("credit_guarantee", "Credit guarantee", YES_NO, d?.creditGuarantee ? "yes" : "no")}
            {select("lease_guarantee", "Lease guarantee", YES_NO, d?.leaseGuarantee ? "yes" : "no")}
          </>,
        )}

        {section(
          "Notes",
          <div className={ui.field} data-wide="">
            <textarea
              id={`${id}-notes`}
              name="notes"
              className={ui.textarea}
              aria-label="Notes"
              rows={3}
              maxLength={5000}
              defaultValue={d?.notes ?? ""}
            />
          </div>,
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

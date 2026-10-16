"use client";

import { startTransition, useActionState, useId, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { Select } from "@/components/ui/Select";
import ui from "@/features/data-room/ui.module.css";
import { recordComputeDealAction, type ContractFormState } from "./actions";
import styles from "./contracts.module.css";
import type { LinkOption } from "./contracts";
import { contractValue, DEAL_STRUCTURES } from "./deals";

const INITIAL: ContractFormState = {};

const NONE = { value: "", label: "None" };

const STRUCTURES = [NONE, ...DEAL_STRUCTURES.map((value) => ({ value, label: value }))];

const MAX_DOCUMENTS = 10;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const safeSegment = (name: string): string => name.replace(/[^\w.-]+/g, "_").slice(-120) || "contract.pdf";

/** Today in the browser's timezone, as a date input wants it. */
const today = (): string => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const parse = (value: string): number | null => {
  const number = Number(value.replace(/[$,\s]/g, ""));
  return value.trim() && Number.isFinite(number) ? number : null;
};

/**
 * Records a compute deal signed outside the portal: the Compute opportunity it
 * closes, its cluster and economics, and its executed PDFs (MSA, order forms),
 * which upload straight to Blob before the form is submitted.
 */
export function ComputeDealForm({
  opportunities,
  sites,
}: {
  opportunities: readonly LinkOption[];
  sites: readonly LinkOption[];
}): ReactElement {
  const id = useId();
  const [state, action, saving] = useActionState(recordComputeDealAction, INITIAL);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [counterparty, setCounterparty] = useState("");
  const [rate, setRate] = useState({ gpus: "", hourly: "", term: "" });
  const [documents, setDocuments] = useState<number[]>([0]);
  const busy = uploading || saving;
  const error = uploadError ?? state.error;
  const suggestedValue = contractValue(parse(rate.gpus), parse(rate.hourly), parse(rate.term));

  const pickOpportunity = (value: string) => {
    const company = opportunities.find((option) => option.value === value)?.detail;
    if (company && !counterparty.trim()) setCounterparty(company);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const files = formData.getAll("document_file");
    if (!files.length || files.some((file) => !(file instanceof File) || file.size === 0)) {
      return setUploadError("Attach each executed document as a PDF.");
    }
    if (files.some((file) => (file as File).type !== "application/pdf")) return setUploadError("Each document must be a PDF.");
    if (!formData.get("value_usd") && suggestedValue != null) formData.set("value_usd", String(suggestedValue));

    setUploadError(null);
    setUploading(true);
    try {
      const blobs = await Promise.all(
        (files as File[]).map((file) =>
          upload(`contracts/compute/${safeSegment(file.name)}`, file, {
            access: "private",
            handleUploadUrl: "/api/contracts/upload",
            contentType: "application/pdf",
          }),
        ),
      );
      formData.delete("document_file");
      for (const blob of blobs) formData.append("document_pathname", blob.pathname);
      startTransition(() => action(formData));
    } catch (failure) {
      setUploadError(failure instanceof Error ? failure.message : "The upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const label = (key: string, text: string) => (
    <label id={`${id}-${key}-label`} htmlFor={`${id}-${key}`} className={ui.label}>
      {text}
    </label>
  );

  const input = (key: string, text: string, props: Record<string, unknown> = {}) => (
    <div className={ui.field}>
      {label(key, text)}
      <input id={`${id}-${key}`} name={key} className={ui.input} maxLength={200} {...props} />
    </div>
  );

  const group = (title: string, children: ReactNode) => (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{title}</legend>
      <div className={styles.grid}>{children}</div>
    </fieldset>
  );

  const figure = (key: keyof typeof rate) => ({
    inputMode: "decimal",
    value: rate[key],
    onChange: (event: { target: { value: string } }) => setRate((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <form className={styles.form} onSubmit={submit}>
      {group(
        "Parties",
        <>
          <div className={ui.field}>
            {label("opportunity_id", "Opportunity *")}
            <Select
              id={`${id}-opportunity_id`}
              aria-labelledby={`${id}-opportunity_id-label`}
              name="opportunity_id"
              className={ui.fill}
              options={opportunities.length ? opportunities : [{ value: "", label: "No Compute opportunities" }]}
              onChange={pickOpportunity}
            />
          </div>
          <div className={ui.field}>
            {label("counterparty", "Counterparty *")}
            <input
              id={`${id}-counterparty`}
              name="counterparty"
              className={ui.input}
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
              required
              maxLength={200}
            />
          </div>
          {input("provider_entity", "Provider", { placeholder: "ZODE SUPER CLUSTER A LLC" })}
          <div className={ui.field}>
            {label("site_id", "Site")}
            <Select
              id={`${id}-site_id`}
              aria-labelledby={`${id}-site_id-label`}
              name="site_id"
              className={ui.fill}
              options={[NONE, ...sites]}
              defaultValue=""
            />
          </div>
        </>,
      )}
      {group(
        "Dates",
        <>
          {input("signed_on", "Signed *", { type: "date", defaultValue: today(), required: true })}
          {input("effective_on", "Effective", { type: "date" })}
          {input("msa_on", "MSA dated", { type: "date" })}
          {input("delivery_on", "Cluster delivery", { type: "date" })}
          {input("acceptance_deadline_on", "Acceptance deadline", { type: "date" })}
        </>,
      )}
      {group(
        "Cluster",
        <>
          {input("gpu_model", "GPU", { placeholder: "B300" })}
          {input("gpu_count", "GPUs", { ...figure("gpus"), inputMode: "numeric", placeholder: "0" })}
          {input("node_count", "Nodes", { inputMode: "numeric", placeholder: "0" })}
          {input("it_mw", "IT MW", { inputMode: "decimal", placeholder: "0" })}
          <div className={ui.field} data-wide="">
            {label("location", "Location")}
            <input id={`${id}-location`} name="location" className={ui.input} maxLength={200} placeholder="Data center, as the order form names it" />
          </div>
        </>,
      )}
      {group(
        "Economics",
        <>
          {input("gpu_hour_usd", "GPU-hour rate (USD)", { ...figure("hourly"), placeholder: "0.00" })}
          {input("term_months", "Term (months)", { ...figure("term"), inputMode: "numeric", placeholder: "0" })}
          {input("renewal_months", "Renews for (months)", { inputMode: "numeric", placeholder: "0" })}
          <div className={ui.field}>
            {label("structure", "Structure")}
            <Select
              id={`${id}-structure`}
              aria-labelledby={`${id}-structure-label`}
              name="structure"
              className={ui.fill}
              options={STRUCTURES}
              defaultValue=""
            />
          </div>
          {input("value_usd", "Total value (USD)", {
            inputMode: "decimal",
            placeholder: suggestedValue == null ? "0" : usd.format(suggestedValue),
          })}
          {input("prepayment_usd", "Prepayment (USD)", { inputMode: "decimal", placeholder: "0" })}
          {input("prepayment_due_on", "Prepayment due", { type: "date" })}
          {input("uptime_pct", "Uptime SLA (%)", { inputMode: "decimal", placeholder: "99.5" })}
        </>,
      )}
      {group(
        "Documents",
        <>
          {documents.map((key, index) => (
            <div key={key} className={styles.document} data-wide="">
              <div className={ui.field}>
                {label(`document_label_${key}`, `Document ${index + 1} *`)}
                <input
                  id={`${id}-document_label_${key}`}
                  name="document_label"
                  className={ui.input}
                  placeholder={index === 0 ? "MSA" : "Order Form No. 1"}
                  required
                  maxLength={200}
                />
              </div>
              <input
                name="document_file"
                type="file"
                accept="application/pdf"
                aria-label={`Document ${index + 1} PDF`}
                className={styles.file}
                required
              />
              {documents.length > 1 ? (
                <button
                  type="button"
                  className={ui.button}
                  onClick={() => setDocuments((current) => current.filter((other) => other !== key))}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {documents.length < MAX_DOCUMENTS ? (
            <div data-wide="">
              <button
                type="button"
                className={ui.button}
                onClick={() => setDocuments((current) => [...current, Math.max(...current) + 1])}
              >
                Add document
              </button>
            </div>
          ) : null}
        </>,
      )}
      <div className={ui.field}>
        {label("notes", "Notes")}
        <textarea id={`${id}-notes`} name="notes" className={ui.textarea} rows={3} maxLength={5000} />
      </div>
      {error ? (
        <p className={ui.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Link href="/portal/contracts/all" className={ui.button}>
          Cancel
        </Link>
        <button type="submit" className={ui.primary} disabled={busy || !opportunities.length}>
          {uploading ? "Uploading…" : saving ? "Saving…" : "Record deal"}
        </button>
      </div>
    </form>
  );
}

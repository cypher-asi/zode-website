"use client";

import { startTransition, useActionState, useId, useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { Select } from "@/components/ui/Select";
import ui from "@/features/data-room/ui.module.css";
import { recordComputeContractAction, type ContractFormState } from "./actions";
import styles from "./contracts.module.css";
import type { LinkOption } from "./contracts";

const INITIAL: ContractFormState = {};

const MODES = [
  { value: "buy", label: "Purchase" },
  { value: "rent", label: "Rental" },
];

const NONE = { value: "", label: "None" };

const safeSegment = (name: string): string => name.replace(/[^\w.-]+/g, "_").slice(-120) || "contract.pdf";

/** Today in the browser's timezone, as a date input wants it. */
const today = (): string => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

/**
 * Records a compute contract signed outside the portal: its figures, what it
 * links to in ZRM and Capacity, and the executed PDF, which uploads straight
 * to Blob before the form is submitted.
 */
export function ComputeContractForm({
  opportunities,
  sites,
}: {
  opportunities: readonly LinkOption[];
  sites: readonly LinkOption[];
}): ReactElement {
  const id = useId();
  const [state, action, saving] = useActionState(recordComputeContractAction, INITIAL);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [counterparty, setCounterparty] = useState("");
  const busy = uploading || saving;
  const error = uploadError ?? state.error;

  const pickOpportunity = (value: string) => {
    const company = opportunities.find((option) => option.value === value)?.detail;
    if (company && !counterparty.trim()) setCounterparty(company);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("pdf");
    if (!(file instanceof File) || file.size === 0) return setUploadError("Attach the executed contract as a PDF.");
    if (file.type !== "application/pdf") return setUploadError("The contract must be a PDF.");

    setUploadError(null);
    setUploading(true);
    try {
      const blob = await upload(`contracts/compute/${safeSegment(file.name)}`, file, {
        access: "private",
        handleUploadUrl: "/api/contracts/upload",
        contentType: "application/pdf",
      });
      formData.delete("pdf");
      formData.set("pdf_pathname", blob.pathname);
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

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.grid}>
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
        <div className={ui.field}>
          {label("signed_on", "Signed *")}
          <input id={`${id}-signed_on`} name="signed_on" type="date" className={ui.input} defaultValue={today()} required />
        </div>
        <div className={ui.field}>
          {label("mode", "Type")}
          <Select
            id={`${id}-mode`}
            aria-labelledby={`${id}-mode-label`}
            name="mode"
            className={ui.fill}
            options={MODES}
            defaultValue="buy"
          />
        </div>
        <div className={ui.field}>
          {label("opportunity_id", "Opportunity")}
          <Select
            id={`${id}-opportunity_id`}
            aria-labelledby={`${id}-opportunity_id-label`}
            name="opportunity_id"
            className={ui.fill}
            options={[NONE, ...opportunities]}
            defaultValue=""
            onChange={pickOpportunity}
          />
        </div>
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
        <div className={ui.field}>
          {label("it_mw", "IT MW")}
          <input id={`${id}-it_mw`} name="it_mw" className={ui.input} inputMode="decimal" placeholder="0" />
        </div>
        <div className={ui.field}>
          {label("value_usd", "Total value (USD)")}
          <input id={`${id}-value_usd`} name="value_usd" className={ui.input} inputMode="decimal" placeholder="0" />
        </div>
        <div className={ui.field}>
          {label("monthly_usd", "Monthly (USD)")}
          <input id={`${id}-monthly_usd`} name="monthly_usd" className={ui.input} inputMode="decimal" placeholder="0" />
        </div>
        <div className={ui.field}>
          {label("term_months", "Term (months)")}
          <input id={`${id}-term_months`} name="term_months" className={ui.input} inputMode="numeric" placeholder="0" />
        </div>
        <div className={ui.field} data-wide="">
          {label("notes", "Notes")}
          <textarea id={`${id}-notes`} name="notes" className={ui.textarea} rows={3} maxLength={5000} />
        </div>
        <div className={ui.field} data-wide="">
          {label("pdf", "Executed contract (PDF) *")}
          <input id={`${id}-pdf`} name="pdf" type="file" accept="application/pdf" className={styles.file} required />
        </div>
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
        <button type="submit" className={ui.primary} disabled={busy}>
          {uploading ? "Uploading…" : saving ? "Saving…" : "Record contract"}
        </button>
      </div>
    </form>
  );
}

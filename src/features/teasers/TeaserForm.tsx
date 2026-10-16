"use client";

import {
  startTransition,
  useActionState,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import form from "@/features/deployments/deployments.module.css";
import { deleteTeaserAction, saveTeaserAction, type TeaserFormState } from "./actions";
import { LIMITS, type TeaserInput } from "./types";
import styles from "./teasers.module.css";

const INITIAL: TeaserFormState = {};

interface Column<Key extends string> {
  key: Key;
  label: string;
  max: number;
  placeholder?: string;
  width: string;
}

/**
 * An editable list of rows, each submitted as parallel `<prefix>_<key>`
 * fields in order, up to `maxRows`.
 */
function Rows<Key extends string>({
  prefix,
  noun,
  columns,
  initial,
  maxRows,
  fixed,
}: {
  prefix: string;
  noun: string;
  columns: readonly Column<Key>[];
  initial: readonly Record<Key, string>[];
  maxRows: number;
  /** Always `maxRows` rows, with no adding or removing. */
  fixed?: boolean;
}): ReactElement {
  const blank = () => Object.fromEntries(columns.map((column) => [column.key, ""])) as Record<Key, string>;
  const start = fixed
    ? Array.from({ length: maxRows }, (_, i) => initial[i] ?? blank())
    : initial.length
      ? [...initial]
      : [blank()];
  const [rows, setRows] = useState(() => start.map((values, key) => ({ key, values })));
  const nextKey = useRef(rows.length);
  const template = `${columns.map((column) => column.width).join(" ")}${fixed ? "" : " 32px"}`;

  return (
    <div className={styles.rows}>
      <div className={styles.rowHead} style={{ gridTemplateColumns: template }} aria-hidden="true">
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
        {fixed ? null : <span />}
      </div>
      {rows.map((row, i) => (
        <div key={row.key} className={styles.row} style={{ gridTemplateColumns: template }}>
          {columns.map((column) => (
            <input
              key={column.key}
              name={`${prefix}_${column.key}`}
              className={ui.input}
              aria-label={`${noun} ${i + 1} ${column.label.toLowerCase()}`}
              maxLength={column.max}
              placeholder={column.placeholder}
              value={row.values[column.key]}
              onChange={(event) =>
                setRows((all) =>
                  all.map((r) =>
                    r.key === row.key ? { ...r, values: { ...r.values, [column.key]: event.target.value } } : r,
                  ),
                )
              }
            />
          ))}
          {fixed ? null : (
            <button
              type="button"
              className={ui.iconButton}
              aria-label={`Remove ${noun} ${i + 1}`}
              onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
      ))}
      {fixed ? null : (
        <div>
          <button
            type="button"
            className={ui.button}
            disabled={rows.length >= maxRows}
            onClick={() => setRows((all) => [...all, { key: nextKey.current++, values: blank() }])}
          >
            Add {noun}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Edits a teaser, starting from `teaser` (a new one's draft from its
 * deployment, or the saved one with `id`), for the ZODE team.
 */
export function TeaserForm({ teaser, id: teaserId }: { teaser: TeaserInput; id?: string }): ReactElement {
  const id = useId();
  const t = teaser;
  const [state, action, saving] = useActionState(saveTeaserAction, INITIAL);
  const [summary, setSummary] = useState(t.summary);
  const [highlights, setHighlights] = useState(t.highlights);
  const [deleting, setDeleting] = useState(false);
  const highlightLines = highlights.split("\n").filter((line) => line.trim()).length;

  // Submitted by hand so a rejected save keeps everything typed.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };

  const input = (key: string, label: string, value: string, max: number, placeholder?: string, wide?: boolean) => (
    <div className={ui.field} data-wide={wide ? "" : undefined}>
      <label htmlFor={`${id}-${key}`} className={ui.label}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        name={key}
        className={ui.input}
        defaultValue={value}
        maxLength={max}
        placeholder={placeholder}
      />
    </div>
  );

  const section = (title: string, children: ReactNode, hint?: string) => (
    <fieldset className={form.fieldset}>
      <legend className={form.legend}>{title}</legend>
      {hint ? <p className={form.summary}>{hint}</p> : null}
      {children}
    </fieldset>
  );

  return (
    <>
      <form className={form.form} onSubmit={submit}>
        {teaserId ? <input type="hidden" name="id" value={teaserId} /> : null}
        <input type="hidden" name="deployment_id" value={t.deploymentId} />

        {section(
          "Heading",
          <div className={form.grid}>
            {input("name", "Name (not printed) *", t.name, LIMITS.name, "e.g. Chicago, for SourceM3D", true)}
            {input("eyebrow", "Eyebrow", t.eyebrow, LIMITS.eyebrow, "Chicago · Available Feb 2027", true)}
            {input("headline", "Headline *", t.headline, LIMITS.headline, "2,048 NVIDIA B300 GPUs in Chicago", true)}
            {input("subheadline", "Subheadline", t.subheadline, LIMITS.subheadline, undefined, true)}
          </div>,
        )}

        {section(
          "Key figures",
          <Rows
            prefix="stat"
            noun="Figure"
            fixed
            maxRows={LIMITS.stats}
            initial={t.stats}
            columns={[
              { key: "value", label: "Figure", max: LIMITS.statValue, placeholder: "2,048", width: "minmax(100px, 1fr)" },
              { key: "label", label: "Label", max: LIMITS.statLabel, placeholder: "B300 · Feb 2027", width: "minmax(160px, 2fr)" },
            ]}
          />,
          "Up to four, printed in tiles under the headline. Leave a row blank to drop it.",
        )}

        {section(
          "Overview",
          <div className={form.grid}>
            <div className={ui.field} data-wide="">
              <label htmlFor={`${id}-summary`} className={ui.label}>
                Overview ({summary.length} of {LIMITS.summary})
              </label>
              <textarea
                id={`${id}-summary`}
                name="summary"
                className={ui.textarea}
                rows={4}
                maxLength={LIMITS.summary}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
            <div className={ui.field} data-wide="">
              <label htmlFor={`${id}-highlights`} className={ui.label}>
                Highlights, one per line ({highlightLines} of {LIMITS.highlights}, {LIMITS.highlight} characters each)
              </label>
              <textarea
                id={`${id}-highlights`}
                name="highlights"
                className={ui.textarea}
                rows={4}
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
              />
            </div>
          </div>,
        )}

        {section(
          "Availability",
          <Rows
            prefix="availability"
            noun="Row"
            maxRows={LIMITS.availability}
            initial={t.availability}
            columns={[
              { key: "label", label: "Phase", max: LIMITS.availabilityLabel, placeholder: "Phase 1", width: "minmax(110px, 1fr)" },
              {
                key: "capacity",
                label: "Capacity",
                max: LIMITS.availabilityCapacity,
                placeholder: "2,048 B300 GPUs · 3.8 MW",
                width: "minmax(200px, 2fr)",
              },
              { key: "date", label: "Ready for service", max: LIMITS.availabilityDate, placeholder: "Feb 15, 2027", width: "minmax(120px, 1fr)" },
            ]}
          />,
        )}

        {section(
          "Specifications",
          <Rows
            prefix="spec"
            noun="Spec"
            maxRows={LIMITS.specs}
            initial={t.specs}
            columns={[
              { key: "label", label: "Label", max: LIMITS.specLabel, placeholder: "Networking", width: "minmax(120px, 1fr)" },
              { key: "value", label: "Value", max: LIMITS.specValue, placeholder: "InfiniBand", width: "minmax(180px, 2fr)" },
            ]}
          />,
        )}

        {section(
          "Terms",
          <Rows
            prefix="term"
            noun="Term"
            maxRows={LIMITS.terms}
            initial={t.terms}
            columns={[
              { key: "label", label: "Label", max: LIMITS.termLabel, placeholder: "Pricing", width: "minmax(120px, 1fr)" },
              { key: "value", label: "Value", max: LIMITS.termValue, placeholder: "On request", width: "minmax(180px, 2fr)" },
            ]}
          />,
        )}

        {section(
          "Contact",
          <div className={form.grid}>
            {input("contact_name", "Name", t.contactName, LIMITS.contactName)}
            {input("contact_email", "Email", t.contactEmail, LIMITS.contactEmail)}
          </div>,
        )}

        {state.error ? (
          <p className={ui.error} role="alert">
            {state.error}
          </p>
        ) : null}
        <div className={form.actions}>
          {teaserId ? (
            <button type="button" className={ui.danger} onClick={() => setDeleting(true)} data-start="">
              Delete
            </button>
          ) : null}
          <Link href={`/portal/deployments/${t.deploymentId}`} className={ui.button}>
            Cancel
          </Link>
          <button type="submit" className={ui.primary} disabled={saving}>
            {saving ? "Saving…" : teaserId ? "Save and preview" : "Create teaser"}
          </button>
        </div>
      </form>

      {deleting && teaserId ? (
        <Dialog
          title={`Delete ${t.name}?`}
          description="The teaser is removed for the whole team. PDFs already sent aren't affected."
          confirmLabel="Delete teaser"
          danger
          onConfirm={async () => (await deleteTeaserAction(teaserId)).error}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}

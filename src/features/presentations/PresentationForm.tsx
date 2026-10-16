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
import { Rows, type Column } from "@/features/teasers/TeaserForm";
import { deletePresentationAction, savePresentationAction, type PresentationFormState } from "./actions";
import { LIMITS, linesOf, type PresentationInput, type Section } from "./types";
import styles from "./presentations.module.css";

const INITIAL: PresentationFormState = {};

const FACT_COLUMNS: readonly Column<"label" | "value">[] = [
  { key: "label", label: "Label", max: LIMITS.factLabel, placeholder: "Utility feed", width: "minmax(120px, 1fr)" },
  { key: "value", label: "Value", max: LIMITS.factValue, placeholder: "Two 12 kV utility feeds", width: "minmax(200px, 2fr)" },
];

const BLANK_SECTION: Section = { title: "", body: "", bullets: "", facts: [] };

/** A textarea with its count in the label. */
function Area({
  id,
  name,
  label,
  initial,
  max,
  rows = 4,
  lines,
}: {
  id: string;
  name: string;
  label: string;
  initial: string;
  /** Characters, or with `lines` the characters per line. */
  max: number;
  rows?: number;
  /** One per line, at most this many. */
  lines?: number;
}): ReactElement {
  const [value, setValue] = useState(initial);
  const count = lines
    ? `${linesOf(value).length} of ${lines}, ${max} characters each`
    : `${value.length} of ${max}`;
  return (
    <div className={ui.field} data-wide="">
      <label htmlFor={`${id}-${name}`} className={ui.label}>
        {label} ({count})
      </label>
      <textarea
        id={`${id}-${name}`}
        name={name}
        className={ui.textarea}
        rows={rows}
        maxLength={lines ? undefined : max}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

/**
 * Edits a deployment's presentation, starting from `presentation` (a new one's
 * draft from its deployment, or the saved one when `saved`), for the ZODE team.
 */
export function PresentationForm({ presentation, saved }: { presentation: PresentationInput; saved?: boolean }): ReactElement {
  const id = useId();
  const p = presentation;
  const [state, action, saving] = useActionState(savePresentationAction, INITIAL);
  const [deleting, setDeleting] = useState(false);
  const [sections, setSections] = useState(() => p.sections.map((section, key) => ({ key, section })));
  const nextSection = useRef(sections.length);

  // Submitted by hand so a rejected save keeps everything typed.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };

  const input = (key: string, label: string, value: string, max: number, placeholder?: string) => (
    <div className={ui.field} data-wide="">
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

  const fieldset = (title: string, children: ReactNode, hint?: string) => (
    <fieldset className={form.fieldset}>
      <legend className={form.legend}>{title}</legend>
      {hint ? <p className={form.summary}>{hint}</p> : null}
      {children}
    </fieldset>
  );

  return (
    <>
      <form className={form.form} onSubmit={submit}>
        <input type="hidden" name="deployment_id" value={p.deploymentId} />

        {fieldset(
          "Cover",
          <div className={form.grid}>
            {input("eyebrow", "Eyebrow", p.eyebrow, LIMITS.eyebrow, "Site overview · Chicago")}
            {input("title", "Title *", p.title, LIMITS.title, "Chicago · 801 S Canal")}
            {input("subtitle", "Subtitle", p.subtitle, LIMITS.subtitle)}
          </div>,
        )}

        {fieldset(
          "At a glance",
          <div className={form.grid}>
            <div className={ui.field} data-wide="">
              <Rows
                prefix="stat"
                noun="Figure"
                fixed
                maxRows={LIMITS.stats}
                initial={p.stats}
                columns={[
                  { key: "value", label: "Figure", max: LIMITS.statValue, placeholder: "2,048", width: "minmax(100px, 1fr)" },
                  { key: "label", label: "Label", max: LIMITS.statLabel, placeholder: "B300 · Feb 2027", width: "minmax(160px, 2fr)" },
                ]}
              />
            </div>
            <Area id={id} name="summary" label="Overview" initial={p.summary} max={LIMITS.summary} />
            <Area
              id={id}
              name="highlights"
              label="Why this site, one per line"
              initial={p.highlights}
              max={LIMITS.highlight}
              lines={LIMITS.highlights}
            />
          </div>,
          "Up to four key figures in tiles, leave a row blank to drop it, then the overview beside the highlights.",
        )}

        {fieldset(
          "The site",
          <div className={form.grid}>
            <Area id={id} name="site_summary" label="Overview" initial={p.siteSummary} max={LIMITS.siteSummary} />
            <div className={ui.field} data-wide="">
              <span className={ui.label}>Key facts</span>
              <Rows prefix="site_fact" noun="Fact" maxRows={LIMITS.siteFacts} initial={p.siteFacts} columns={FACT_COLUMNS} />
            </div>
          </div>,
        )}

        {fieldset(
          "Capacity and rollout",
          <Rows
            prefix="rollout"
            noun="Phase"
            maxRows={LIMITS.rollout}
            initial={p.rollout}
            columns={[
              { key: "label", label: "Phase", max: LIMITS.rolloutLabel, placeholder: "Phase 1", width: "minmax(100px, 1fr)" },
              {
                key: "capacity",
                label: "Capacity",
                max: LIMITS.rolloutCapacity,
                placeholder: "2,048 B300 GPUs · 256 nodes",
                width: "minmax(200px, 2fr)",
              },
              { key: "power", label: "Power", max: LIMITS.rolloutPower, placeholder: "3.8 MW", width: "minmax(80px, 0.8fr)" },
              { key: "date", label: "Ready for service", max: LIMITS.rolloutDate, placeholder: "Feb 15, 2027", width: "minmax(120px, 1fr)" },
            ]}
          />,
          "A table of the phases, with a timeline under it.",
        )}

        {fieldset(
          "The cluster",
          <div className={form.grid}>
            <Area id={id} name="cluster_summary" label="Overview" initial={p.clusterSummary} max={LIMITS.clusterSummary} />
            <div className={ui.field} data-wide="">
              <span className={ui.label}>Specifications</span>
              <Rows prefix="spec" noun="Spec" maxRows={LIMITS.specs} initial={p.specs} columns={FACT_COLUMNS} />
            </div>
          </div>,
        )}

        {fieldset(
          "Added slides",
          <div className={styles.sections}>
            {sections.map(({ key, section }, i) => (
              <div key={key} className={styles.section}>
                <input type="hidden" name="section" value={key} />
                <div className={styles.sectionHead}>
                  <span className={ui.label}>Slide {i + 1}</span>
                  <button
                    type="button"
                    className={ui.button}
                    onClick={() => setSections((all) => all.filter((s) => s.key !== key))}
                  >
                    Remove slide
                  </button>
                </div>
                <div className={form.grid}>
                  {input(`section_${key}_title`, "Title *", section.title, LIMITS.sectionTitle, "Power")}
                  <Area id={id} name={`section_${key}_body`} label="Text" initial={section.body} max={LIMITS.sectionBody} />
                  <Area
                    id={id}
                    name={`section_${key}_bullets`}
                    label="Points, one per line"
                    initial={section.bullets}
                    max={LIMITS.bullet}
                    lines={LIMITS.bullets}
                  />
                  <div className={ui.field} data-wide="">
                    <span className={ui.label}>Key facts</span>
                    <Rows
                      prefix={`section_${key}_fact`}
                      noun="Fact"
                      maxRows={LIMITS.sectionFacts}
                      initial={section.facts}
                      columns={FACT_COLUMNS}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div>
              <button
                type="button"
                className={ui.button}
                disabled={sections.length >= LIMITS.sections}
                onClick={() => setSections((all) => [...all, { key: nextSection.current++, section: BLANK_SECTION }])}
              >
                Add slide
              </button>
            </div>
          </div>,
          "The site's own story, like its power, cooling, redundancy or connectivity: a slide each, after the cluster.",
        )}

        {fieldset(
          "Commercial terms",
          <Rows
            prefix="term"
            noun="Term"
            maxRows={LIMITS.terms}
            initial={p.terms}
            columns={[
              { key: "label", label: "Label", max: LIMITS.termLabel, placeholder: "Pricing", width: "minmax(120px, 1fr)" },
              { key: "value", label: "Value", max: LIMITS.termValue, placeholder: "On request", width: "minmax(180px, 2fr)" },
            ]}
          />,
          "Leave every row blank to drop the slide.",
        )}

        {fieldset(
          "Next steps and contact",
          <div className={form.grid}>
            <Area
              id={id}
              name="next_steps"
              label="Next steps, one per line"
              initial={p.nextSteps}
              max={LIMITS.nextStep}
              lines={LIMITS.nextSteps}
            />
            {input("contact_name", "Contact name", p.contactName, LIMITS.contactName)}
            {input("contact_email", "Contact email", p.contactEmail, LIMITS.contactEmail)}
          </div>,
        )}

        <p className={form.summary}>
          The PDF opens for anyone who can open the deployment, its public link included, so keep anything internal out
          of it.
        </p>
        {state.error ? (
          <p className={ui.error} role="alert">
            {state.error}
          </p>
        ) : null}
        <div className={form.actions}>
          {saved ? (
            <button type="button" className={ui.danger} onClick={() => setDeleting(true)} data-start="">
              Delete
            </button>
          ) : null}
          <Link href={`/portal/deployments/${p.deploymentId}`} className={ui.button}>
            Cancel
          </Link>
          <button type="submit" className={ui.primary} disabled={saving}>
            {saving ? "Saving…" : saved ? "Save and preview" : "Create presentation"}
          </button>
        </div>
      </form>

      {deleting && saved ? (
        <Dialog
          title="Delete the presentation?"
          description="It's removed for everyone who can open the deployment. PDFs already sent aren't affected."
          confirmLabel="Delete presentation"
          danger
          onConfirm={async () => (await deletePresentationAction(p.deploymentId)).error}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </>
  );
}

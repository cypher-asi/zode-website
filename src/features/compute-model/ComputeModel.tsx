"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import { Readouts, Segmented, StepTabs } from "@/features/configurator/StepPanel";
import { multiple, orNa, pct, usdShort } from "./format";
import { runModel, type ModelResult, type StartDate } from "./model/engine";
import {
  GPUS_PER_NODE,
  SCENARIOS,
  SCENARIO_IDS,
  SECTIONS,
  bound,
  type FieldDef,
  type ModelInputs,
  type NumericKey,
  type ScenarioId,
  type SectionId,
  withScenario,
} from "./model/inputs";
import { defaultsFor, inputsFromParams, writeInputParams } from "./model/url";
import { ModelChart } from "./ModelChart";
import { ModelChecks, ModelNotes, ResultsHeader } from "./ResultsHeader";
import { Slider, Toggle } from "./Slider";
import styles from "./ComputeModel.module.css";

const PANEL_ID = "compute-model-inputs";
const URL_DELAY_MS = 300;

const SCENARIO_OPTIONS = SCENARIO_IDS.map((id) => ({ id, label: SCENARIOS[id].label }));
const TABS = SECTIONS.map(({ id, tab }) => ({ id, title: tab }));

/** Pulls inputs whose range depends on another input back inside it. */
function clampToFields(inputs: ModelInputs): ModelInputs {
  const next = { ...inputs };
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (field.kind !== "range") continue;
      const min = bound(field.min, next);
      const max = bound(field.max, next);
      next[field.key] = Math.min(max, Math.max(min, next[field.key]));
    }
  }
  return next;
}

/** Figures derived from each section's inputs, shown above its controls. */
function sectionReadouts(id: SectionId, i: ModelInputs, r: ModelResult) {
  switch (id) {
    case "cluster":
      return [
        { label: "GPUs", value: r.gpus.toLocaleString("en-US"), detail: `${GPUS_PER_NODE} per node` },
        { label: "Power", value: `${r.itMw.toFixed(2)} MW`, detail: `${r.facilityMw.toFixed(2)} MW facility at PUE ${i.pue}` },
        { label: "Equipment", value: usdShort(r.equipmentPurchase), detail: "Nodes plus IT" },
        { label: "Total capex", value: usdShort(r.totalCapex), detail: "With spares, taxes and setup" },
      ];
    case "revenue":
      return [
        { label: "Contract value", value: usdShort(r.contractValue), detail: `${i.contractMonths}-month term` },
        { label: "Year 1 revenue", value: usdShort(r.year1Revenue), detail: "Net of credits and fees" },
      ];
    case "facility": {
      const power = { label: "Power / month", value: usdShort(r.year1Electricity), detail: "Year 1 average electricity" };
      if (i.siteMode === 0) {
        const lease = { label: "Lease / month", value: usdShort(r.year1Lease), detail: "Year 1 average, base + NNN + ops" };
        if (r.siteCost <= 0) return [lease, power];
        return [{ label: "Capital contribution", value: usdShort(r.siteCost), detail: "Paid to the landlord at the start" }, lease, power];
      }
      return [
        { label: "Site cost", value: usdShort(r.siteCost), detail: "Purchase, closing and conversion" },
        { label: "Site equity", value: usdShort(r.siteEquity), detail: `After a ${usdShort(r.siteLoan)} bank loan` },
        { label: "Debt service / month", value: usdShort(r.year1SiteService), detail: "Site loan, year 1 average" },
        power,
      ];
    }
    case "operations":
      return [
        { label: "Year 1 EBITDA", value: usdShort(r.year1Ebitda), detail: "After SPV administration" },
        {
          label: "EBITDA margin",
          value: r.year1Revenue > 0 ? pct(r.year1Ebitda / r.year1Revenue, 1) : "n.a.",
          detail: "Operating year 1",
        },
      ];
    case "financing":
      return [
        { label: "GPU loan", value: usdShort(r.loan), detail: `Requested ${usdShort(r.requestedLoan)}` },
        {
          label: "Min DSCR",
          value: orNa(r.minQuarterlyDscr, multiple),
          detail: r.dscrBreaches ? `${r.dscrBreaches} quarterly breaches` : "Quarterly, no breaches",
        },
      ];
    case "equity":
      return [
        { label: "Equity required", value: usdShort(r.prefEquity), detail: `${usdShort(r.prefEquityAtShipment)} by shipment` },
        {
          label: "Preferred IRR",
          value: orNa(r.prefIrr, (n) => pct(n, 1)),
          detail: `MOIC ${orNa(r.prefMoic, multiple)}`,
        },
      ];
  }
}

/**
 * The GPU SPV model as a page, laid out like the buy page: headline returns,
 * the chart and the annual table on the left, and the model's inputs on the
 * right in sections, recalculating the whole monthly forecast on every
 * change. Inputs that differ from the scenario's defaults go in the query
 * string so a link reopens the same case.
 */
export function ComputeModel({
  initialParams,
  start,
}: {
  initialParams: Record<string, string>;
  start: StartDate;
}): ReactElement {
  const [inputs, setInputs] = useState<ModelInputs>(() =>
    clampToFields(inputsFromParams(new URLSearchParams(initialParams))),
  );
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => runModel(inputs, start), [inputs, start]);
  const defaults = useMemo(() => defaultsFor(inputs.scenario), [inputs.scenario]);
  const section = SECTIONS[step];
  const changed = (Object.keys(defaults) as (keyof ModelInputs)[]).some(
    (key) => typeof defaults[key] === "number" && defaults[key] !== inputs[key],
  );

  // Safari throttles replaceState, so a dragged slider writes the URL once it settles.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      writeInputParams(inputs, url.searchParams);
      window.history.replaceState(null, "", url);
    }, URL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [inputs]);

  const update = (key: NumericKey, value: number) => setInputs((current) => clampToFields({ ...current, [key]: value }));
  const changeScenario = (id: ScenarioId) => setInputs((current) => withScenario(current, id));
  const reset = () => setInputs(defaultsFor(inputs.scenario));

  const goTo = (index: number) => {
    setStep(index);
    const body = bodyRef.current;
    if (!body) return;
    if (getComputedStyle(body).overflowY !== "visible") body.scrollTo({ top: 0 });
    else body.scrollIntoView({ block: "start" });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused; the address bar still holds the link.
    }
  };

  return (
    <div className={styles.root}>
      <section className={styles.main} aria-label="Model results">
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>Resources</p>
            <h1 className={styles.heading}>GPU compute model</h1>
          </div>
          <ModelChecks result={result} />
        </header>

        <ResultsHeader result={result} />
        <div className={styles.chart}>
          <ModelChart result={result} />
        </div>
        <ModelNotes result={result} />
      </section>

      <div className={styles.panelFrame}>
        <div className={styles.top}>
          <Segmented label="Scenario" options={SCENARIO_OPTIONS} value={inputs.scenario} onChange={changeScenario} />
          <Link href="/" className={styles.close} aria-label="Close and return home">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </Link>
        </div>
        <div className={styles.scrollFrame}>
          <section ref={bodyRef} id={PANEL_ID} className={styles.panel} data-surface="light" aria-label="Model inputs">
            <header className={styles.panelHead}>
              <h2 className={styles.panelTitle}>{section.title}</h2>
              <div className={styles.panelActions}>
                <button type="button" className={styles.textButton} onClick={copyLink}>
                  {copied ? "Link copied" : "Copy link"}
                </button>
                <button type="button" className={styles.textButton} onClick={reset} disabled={!changed}>
                  Reset
                </button>
              </div>
            </header>

            <div key={section.id} className={styles.stepBody}>
              <Readouts items={sectionReadouts(section.id, inputs, result)} detailLines={2} />
              <div className={styles.fields}>
                {section.fields
                  .filter((field) => !field.visible || field.visible(inputs))
                  .map((field) => (
                    <Field
                      key={field.key}
                      field={field}
                      inputs={inputs}
                      defaultValue={defaults[field.key]}
                      onChange={(value) => update(field.key, value)}
                    />
                  ))}
              </div>
            </div>

            <p className={styles.disclaimer}>
              Defaults follow the ZODE GPU SPV model. Scenarios set merchant pricing, utilization and asset recovery.
            </p>
          </section>
          <OverlayScrollbar targetId={PANEL_ID} />
        </div>
        <div className={styles.footer}>
          <StepTabs steps={TABS} active={step} onSelect={goTo} />
          <nav className={styles.nav} aria-label="Section navigation">
            <button type="button" className={styles.secondary} disabled={step === 0} onClick={() => goTo(step - 1)}>
              <Arrow direction="back" />
              Back
            </button>
            {step < SECTIONS.length - 1 ? (
              <button
                type="button"
                className={styles.primary}
                aria-label={`Next: ${SECTIONS[step + 1].title}`}
                onClick={() => goTo(step + 1)}
              >
                Next
                <Arrow direction="next" />
              </button>
            ) : null}
          </nav>
        </div>
      </div>
    </div>
  );
}

function Field({
  field,
  inputs,
  defaultValue,
  onChange,
}: {
  field: FieldDef;
  inputs: ModelInputs;
  defaultValue: number;
  onChange: (value: number) => void;
}): ReactElement {
  const value = inputs[field.key];
  switch (field.kind) {
    case "toggle":
      return <Toggle label={field.label} value={value === 1} onChange={(on) => onChange(on ? 1 : 0)} />;
    case "choice":
      return (
        <div className={styles.choice}>
          <p className={styles.choiceLabel}>{field.label}</p>
          <Segmented
            label={field.label}
            options={field.options.map((o) => ({ id: String(o.value), label: o.label }))}
            value={String(value)}
            onChange={(id) => onChange(Number(id))}
          />
        </div>
      );
    case "range":
      return (
        <Slider
          label={field.label}
          note={field.note}
          value={value}
          min={bound(field.min, inputs)}
          max={bound(field.max, inputs)}
          step={field.step}
          format={field.format}
          defaultValue={defaultValue}
          onChange={onChange}
        />
      );
  }
}

function Arrow({ direction }: { direction: "back" | "next" }): ReactElement {
  return (
    <svg className={styles.arrow} viewBox="0 0 12 10" aria-hidden="true">
      <path d={direction === "next" ? "M1 5h10M7 1l4 4-4 4" : "M11 5H1M5 1L1 5l4 4"} />
    </svg>
  );
}

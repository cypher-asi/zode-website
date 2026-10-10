"use client";

import { useMemo, useRef, useState, type ReactElement } from "react";
import { OverlayScrollbar } from "@/components/OverlayScrollbar";
import {
  ASSUMPTIONS,
  COOLING,
  DEFAULT_CONFIG,
  DEPLOYMENTS,
  LOCATIONS,
  NETWORKS,
  PLATFORMS,
  REDUNDANCY,
  WORKLOADS,
  quote as price,
  summarize,
  type Config,
  type Focus,
} from "./config";
import { PriceBar } from "./PriceBar";
import { ChoiceGroup, IncludedCard, NodeStepper, Readouts, RedundancyList, StepTabs } from "./StepPanel";
import { ZodePreview } from "./ZodePreview";
import styles from "./Configurator.module.css";

const PANEL_ID = "buy-compute-steps";

const STEPS = [
  {
    id: "compute",
    title: "Compute",
    focus: { pod: "compute", zone: "racks" },
  },
  {
    id: "workload",
    title: "Workload",
    focus: { pod: "compute", zone: "racks" },
  },
  {
    id: "networking",
    title: "Networking",
    focus: { pod: "compute", zone: "spine" },
  },
  {
    id: "redundancy",
    title: "Redundancy",
    focus: { pod: "electrical", zone: null },
  },
] as const satisfies readonly { id: string; title: string; focus: Focus }[];

/**
 * Build-your-own ZODE: the steps panel on the left edits one configuration,
 * which prices itself on every change and drives the drawing on the right
 * and the bar along the bottom.
 */
export function Configurator(): ReactElement {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Focus | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const quote = useMemo(() => price(config), [config]);
  const update = (patch: Partial<Config>) => setConfig((c) => ({ ...c, ...patch }));
  const current = STEPS[step];

  const goTo = (index: number) => {
    setStep(index);
    setPreview(null);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className={styles.root}>
      <div className={styles.panelFrame}>
        <div className={styles.scrollFrame}>
          <section
            ref={bodyRef}
            id={PANEL_ID}
            className={styles.panel}
            data-surface="light"
            aria-label="Configure your ZODE"
          >
            <header className={styles.intro}>
              <h1 className={styles.heading}>Build your ZODE</h1>
            </header>

            <div className={styles.step}>
              <div key={current.id} className={styles.stepBody}>
                {current.id === "compute" ? (
                  <>
                    <NodeStepper value={config.nodes} onChange={(nodes) => update({ nodes })} />
                    <Readouts
                      items={[
                        {
                          label: "GPUs",
                          value: quote.gpus.toLocaleString("en-US"),
                          detail: `${ASSUMPTIONS.gpusPerNode} per node`,
                        },
                        {
                          label: "Power",
                          value: `${quote.mw.toFixed(2)} MW`,
                          detail: `Est. facility load, PUE ${ASSUMPTIONS.pue}`,
                        },
                      ]}
                    />
                    <ChoiceGroup
                      legend="Location"
                      choices={LOCATIONS}
                      value={config.location}
                      onChange={(location) => update({ location })}
                      onPreview={setPreview}
                      inline
                    />
                    <ChoiceGroup
                      legend="GPU platform"
                      choices={PLATFORMS}
                      value={config.platform}
                      onChange={(platform) => update({ platform })}
                      onPreview={setPreview}
                      inline
                    />
                    <IncludedCard legend="Cooling" choice={COOLING} onPreview={setPreview} />
                  </>
                ) : null}

                {current.id === "workload" ? (
                  <>
                    <ChoiceGroup
                      legend="Primary workload"
                      choices={WORKLOADS}
                      value={config.workload}
                      onChange={(workload) => update({ workload })}
                      onPreview={setPreview}
                    />
                    <ChoiceGroup
                      legend="Deployment"
                      choices={DEPLOYMENTS}
                      value={config.deployment}
                      onChange={(deployment) => update({ deployment })}
                      onPreview={setPreview}
                    />
                  </>
                ) : null}

                {current.id === "networking" ? (
                  <ChoiceGroup
                    legend="GPU fabric"
                    choices={NETWORKS}
                    value={config.network}
                    onChange={(network) => update({ network })}
                    onPreview={setPreview}
                  />
                ) : null}

                {current.id === "redundancy" ? (
                  <RedundancyList
                    choices={REDUNDANCY}
                    value={config.redundancy}
                    onChange={(redundancy) => update({ redundancy })}
                    onPreview={setPreview}
                  />
                ) : null}
              </div>
            </div>

            <p className={styles.disclaimer}>
              All prices are placeholder estimates for planning, not a quote.
            </p>
          </section>
          <OverlayScrollbar targetId={PANEL_ID} />
        </div>
        <div className={styles.footer}>
          <StepTabs steps={STEPS} active={step} onSelect={goTo} />
          <nav className={styles.nav} aria-label="Step navigation">
            <button
              type="button"
              className={styles.secondary}
              disabled={step === 0}
              onClick={() => goTo(step - 1)}
            >
              <Arrow direction="back" />
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className={styles.primary}
                aria-label={`Next: ${STEPS[step + 1].title}`}
                onClick={() => goTo(step + 1)}
              >
                Next
                <Arrow direction="next" />
              </button>
            ) : null}
          </nav>
        </div>
      </div>

      <section className={styles.preview} data-surface="light" aria-label="ZODE preview">
        <ZodePreview focus={preview ?? current.focus} quote={quote} />
        <PriceBar quote={quote} summary={summarize(config, quote)} />
      </section>
    </div>
  );
}

function Arrow({ direction }: { direction: "back" | "next" }): ReactElement {
  return (
    <svg className={styles.arrow} viewBox="0 0 12 10" aria-hidden="true">
      <path d={direction === "next" ? "M1 5h10M7 1l4 4-4 4" : "M11 5H1M5 1L1 5l4 4"} />
    </svg>
  );
}

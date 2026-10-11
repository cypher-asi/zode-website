"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
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
  buyPriceView,
  quote as price,
  usdShort,
  type Config,
  type Focus,
} from "./config";
import { OrderStep } from "./OrderStep";
import { PriceBar } from "./PriceBar";
import { RackPreview } from "./RackPreview";
import {
  CPU_MACHINES,
  CPU_MACHINE_COUNTS,
  CPU_MACHINE_HOUR,
  DEFAULT_RENT_CONFIG,
  FABRICS,
  FRONT_ENDS,
  HOST_CPUS,
  LOCAL_STORAGE,
  MGMT_COUNTS,
  RENT_ASSUMPTIONS,
  RENT_COOLING,
  RENT_LOCATIONS,
  RENT_NODE_SIZES,
  RENT_PLATFORMS,
  STORAGE_SIZES,
  STORAGE_TB_PER_RACK,
  STORAGE_TB_PRICE,
  STORAGE_TIERS,
  UPLINKS,
  mgmtNote,
  rentPriceView,
  rentQuote,
  type RackKind,
  type RentConfig,
  type RentQuote,
} from "./rentConfig";
import {
  ChipPicker,
  ChoiceGroup,
  IncludedCard,
  NodeStepper,
  Readouts,
  RedundancyList,
  Segmented,
  StepTabs,
} from "./StepPanel";
import { ZodePreview } from "./ZodePreview";
import styles from "./Configurator.module.css";

const PANEL_ID = "buy-compute-steps";

const BUY_STEPS = [
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
  {
    id: "order",
    title: "Order",
    focus: { pod: "compute", zone: null },
  },
] as const satisfies readonly { id: string; title: string; focus: Focus }[];

const RENT_STEPS = [
  { id: "compute", title: "Compute", focus: "gpu" },
  { id: "networking", title: "Networking", focus: "network" },
  { id: "storage", title: "Storage", focus: "storage" },
  { id: "cpu", title: "CPU", focus: "cpu" },
  { id: "order", title: "Order", focus: "gpu" },
] as const satisfies readonly { id: string; title: string; focus: RackKind }[];

const MODES = [
  { id: "buy", label: "Buy" },
  { id: "rent", label: "Rent" },
] as const;

export type Mode = (typeof MODES)[number]["id"];

const pad = (n: number) => String(n).padStart(2, "0");

const capacity = (tb: number) => (tb === 0 ? "None" : tb >= 1_000 ? `${tb / 1_000} PB` : `${tb} TB`);

/**
 * Build-your-own ZODE, or a rented cluster: the steps panel on the right
 * edits one configuration per mode, which prices itself on every change and
 * drives the drawing on the left and the bar along the bottom. Each mode keeps
 * its own choices while the other is on show.
 */
export function Configurator({ initialMode = "buy" }: { initialMode?: Mode }): ReactElement {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [rent, setRent] = useState<RentConfig>(DEFAULT_RENT_CONFIG);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Focus | null>(null);
  const [rackPreview, setRackPreview] = useState<RackKind | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const quote = useMemo(() => price(config), [config]);
  const rentQ = useMemo(() => rentQuote(rent), [rent]);
  const update = (patch: Partial<Config>) => setConfig((c) => ({ ...c, ...patch }));
  const updateRent = (patch: Partial<RentConfig>) => setRent((c) => ({ ...c, ...patch }));
  const steps = mode === "buy" ? BUY_STEPS : RENT_STEPS;
  const current = steps[step];
  const rentStep = RENT_STEPS[step];
  const view = mode === "buy" ? buyPriceView(config, quote) : rentPriceView(rent, rentQ);

  // On phones the footer pins to the bottom of the screen under the price panel, which stacks on it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const footer = footerRef.current;
    if (!root || !footer) return;
    const observer = new ResizeObserver(() => root.style.setProperty("--nav-h", `${footer.offsetHeight}px`));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const goTo = (index: number) => {
    setStep(index);
    setPreview(null);
    setRackPreview(null);
    const body = bodyRef.current;
    if (!body) return;
    const style = getComputedStyle(body);
    // Phones scroll the page rather than the panel; bring the new step's top back into view.
    if (style.overflowY !== "visible") {
      body.scrollTo({ top: 0 });
    } else if (body.getBoundingClientRect().top < (parseFloat(style.scrollMarginTop) || 0)) {
      body.scrollIntoView({ block: "start" });
    }
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    goTo(0);
    const url = new URL(window.location.href);
    if (next === "rent") url.searchParams.set("mode", "rent");
    else url.searchParams.delete("mode");
    window.history.replaceState(null, "", url);
  };

  return (
    <div ref={rootRef} className={styles.root} data-price-host>
      <div className={styles.panelFrame}>
        <div className={styles.top}>
          <Segmented label="Purchase option" options={MODES} value={mode} onChange={changeMode} />
          <Link href="/" className={styles.close} aria-label="Close and return home">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </Link>
        </div>
        <div className={styles.scrollFrame}>
          <section
            ref={bodyRef}
            id={PANEL_ID}
            className={styles.panel}
            data-surface="light"
            aria-label={mode === "buy" ? "Configure your ZODE" : "Configure your rented cluster"}
          >
            <header className={styles.intro}>
              <h1 className={styles.heading}>{mode === "buy" ? "Build your ZODE" : "Rent your cluster"}</h1>
            </header>

            <div className={styles.step}>
              <div key={`${mode}-${current.id}`} className={styles.stepBody}>
                {current.id === "order" ? (
                  mode === "buy" ? (
                    <OrderStep mode="buy" config={config} view={view} />
                  ) : (
                    <OrderStep mode="rent" config={rent} view={view} />
                  )
                ) : null}

                {mode === "rent" && rentStep.id !== "order" ? (
                  <RentStep
                    id={rentStep.id}
                    config={rent}
                    quote={rentQ}
                    update={updateRent}
                    onPreview={setRackPreview}
                  />
                ) : null}

                {mode === "buy" && current.id === "compute" ? (
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

                {mode === "buy" && current.id === "workload" ? (
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

                {mode === "buy" && current.id === "networking" ? (
                  <ChoiceGroup
                    legend="GPU fabric"
                    choices={NETWORKS}
                    value={config.network}
                    onChange={(network) => update({ network })}
                    onPreview={setPreview}
                  />
                ) : null}

                {mode === "buy" && current.id === "redundancy" ? (
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
        <div ref={footerRef} className={styles.footer}>
          <StepTabs steps={steps} active={step} onSelect={goTo} />
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
            {/* Phones only, where the tabs above shrink to a bare progress line. */}
            <span className={styles.stepLabel} aria-hidden="true">
              <span className={styles.stepCount}>
                {pad(step + 1)} / {pad(steps.length)}
              </span>{" "}
              {current.title}
            </span>
            {step < steps.length - 1 ? (
              <button
                type="button"
                className={styles.primary}
                aria-label={`Next: ${steps[step + 1].title}`}
                onClick={() => goTo(step + 1)}
              >
                Next
                <Arrow direction="next" />
              </button>
            ) : null}
          </nav>
        </div>
      </div>

      {mode === "buy" ? (
        <section className={styles.preview} data-surface="light" aria-label="ZODE preview">
          <ZodePreview focus={preview ?? BUY_STEPS[step].focus} quote={quote} />
          <PriceBar key="buy" view={view} />
        </section>
      ) : (
        <section className={styles.preview} data-surface="light" aria-label="Cluster preview">
          <RackPreview focus={rackPreview ?? RENT_STEPS[step].focus} quote={rentQ} />
          <PriceBar key="rent" view={view} />
        </section>
      )}
    </div>
  );
}

/** The body of one rent step; the order step is shared with buying. */
function RentStep({
  id,
  config,
  quote,
  update,
  onPreview,
}: {
  id: Exclude<(typeof RENT_STEPS)[number]["id"], "order">;
  config: RentConfig;
  quote: RentQuote;
  update: (patch: Partial<RentConfig>) => void;
  onPreview: (focus: RackKind | null) => void;
}): ReactElement {
  const hours = RENT_ASSUMPTIONS.hoursPerMonth;

  switch (id) {
    case "compute":
      return (
        <>
          <NodeStepper sizes={RENT_NODE_SIZES} value={config.nodes} onChange={(nodes) => update({ nodes })} />
          <Readouts
            items={[
              {
                label: "GPUs",
                value: quote.gpus.toLocaleString("en-US"),
                detail: `${ASSUMPTIONS.gpusPerNode} per node`,
              },
              {
                label: "Racks",
                value: String(quote.totalRacks),
                detail: `${quote.racks.gpu} GPU, ${RENT_ASSUMPTIONS.nodesPerRack} nodes each`,
              },
            ]}
          />
          <ChoiceGroup
            legend="Location"
            choices={RENT_LOCATIONS}
            value={config.location}
            onChange={(location) => update({ location })}
            onPreview={onPreview}
            inline
          />
          <ChoiceGroup
            legend="GPU platform"
            choices={RENT_PLATFORMS}
            value={config.platform}
            onChange={(platform) => update({ platform })}
            onPreview={onPreview}
            inline
          />
          <IncludedCard legend="Cooling" choice={RENT_COOLING} onPreview={onPreview} />
        </>
      );

    case "networking":
      return (
        <>
          <ChoiceGroup
            legend="GPU fabric"
            choices={FABRICS}
            value={config.fabric}
            onChange={(fabric) => update({ fabric })}
            onPreview={onPreview}
          />
          <ChoiceGroup
            legend="Front-end network"
            choices={FRONT_ENDS}
            value={config.frontEnd}
            onChange={(frontEnd) => update({ frontEnd })}
            onPreview={onPreview}
            inline
          />
          <ChoiceGroup
            legend="Internet uplink"
            choices={UPLINKS}
            value={config.uplink}
            onChange={(uplink) => update({ uplink })}
            onPreview={onPreview}
            inline
          />
        </>
      );

    case "storage": {
      const perTb = STORAGE_TB_PRICE[config.storageTier];
      return (
        <>
          <Readouts
            items={[
              {
                label: "Storage racks",
                value: String(quote.racks.storage),
                detail: `${STORAGE_TB_PER_RACK[config.storageTier].toLocaleString("en-US")} TB usable per rack`,
              },
              {
                label: "Storage cost",
                value: config.storageTb ? `${usdShort(config.storageTb * perTb)} / mo` : "Included",
                detail: config.storageTb ? `$${perTb} per TB per month` : "Local NVMe only",
              },
            ]}
          />
          <IncludedCard legend="Local storage" choice={LOCAL_STORAGE} onPreview={onPreview} />
          <ChoiceGroup
            legend="Shared storage tier"
            choices={STORAGE_TIERS}
            value={config.storageTier}
            onChange={(storageTier) => update({ storageTier })}
            onPreview={onPreview}
          />
          <ChipPicker
            legend="Shared capacity"
            options={STORAGE_SIZES}
            value={config.storageTb}
            onChange={(storageTb) => update({ storageTb })}
            format={capacity}
            note={config.storageTb ? `${usdShort(config.storageTb * perTb)} / mo` : "None"}
            focus="storage"
            onPreview={onPreview}
          />
        </>
      );
    }

    case "cpu": {
      const machineMonthly = config.cpuMachines * CPU_MACHINE_HOUR[config.cpuMachine] * hours;
      return (
        <>
          <Readouts
            items={[
              {
                label: "Host cores",
                value: quote.hostCores.toLocaleString("en-US"),
                detail: `Across ${quote.nodes.toLocaleString("en-US")} GPU nodes`,
              },
              {
                label: "CPU cores",
                value: quote.cpuCores.toLocaleString("en-US"),
                detail: `${config.cpuMachines} machines, ${quote.racks.cpu} rack${quote.racks.cpu === 1 ? "" : "s"}`,
              },
            ]}
          />
          <ChoiceGroup
            legend="GPU node host CPU"
            choices={HOST_CPUS}
            value={config.hostCpu}
            onChange={(hostCpu) => update({ hostCpu })}
            onPreview={onPreview}
            inline
          />
          <ChoiceGroup
            legend="Separate CPU machines"
            choices={CPU_MACHINES}
            value={config.cpuMachine}
            onChange={(cpuMachine) => update({ cpuMachine })}
            onPreview={onPreview}
            inline
          />
          <ChipPicker
            legend="CPU machines"
            options={CPU_MACHINE_COUNTS}
            value={config.cpuMachines}
            onChange={(cpuMachines) => update({ cpuMachines })}
            format={(n) => (n === 0 ? "None" : String(n))}
            note={config.cpuMachines ? `${usdShort(machineMonthly)} / mo` : "None"}
            focus="cpu"
            onPreview={onPreview}
          />
          <ChipPicker
            legend="Management servers"
            options={MGMT_COUNTS}
            value={config.mgmtServers}
            onChange={(mgmtServers) => update({ mgmtServers })}
            note={mgmtNote(config.mgmtServers)}
            focus="mgmt"
            onPreview={onPreview}
          />
        </>
      );
    }
  }
}

function Arrow({ direction }: { direction: "back" | "next" }): ReactElement {
  return (
    <svg className={styles.arrow} viewBox="0 0 12 10" aria-hidden="true">
      <path d={direction === "next" ? "M1 5h10M7 1l4 4-4 4" : "M11 5H1M5 1L1 5l4 4"} />
    </svg>
  );
}

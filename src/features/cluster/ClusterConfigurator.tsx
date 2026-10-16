"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import { STATUS_LABELS, partStatuses, phaseCoverage, slotsForKind } from "@/features/deployments/bom/coverage";
import { BomPanel, PartBom, type BuilderBom } from "./BomPanel";
import { ControlPanel } from "./ControlPanel";
import { count, power } from "./format";
import { buildCluster } from "./model/build";
import { KIND_LABELS, PLATFORMS } from "./model/catalog";
import type { ClusterConfig, Layer, PartKind } from "./model/types";
import { writeConfigParams } from "./model/url";
import { RackElevation } from "./RackElevation";
import type { ClusterSceneHandle } from "./scene/ClusterScene";
import type { PartFlag, Pick } from "./scene/ClusterView";
import { StatsBar } from "./StatsBar";
import { LayersPanel, ViewPresets } from "./ViewToolbar";
import styles from "./ClusterConfigurator.module.css";

// three.js and the scene live in their own chunk so the panels hydrate without
// waiting on it; `ssr: false` keeps WebGL code off the server. The viewport
// paints the scene's background color until it arrives.
const ClusterScene = dynamic(() => import("./scene/ClusterScene").then((m) => m.ClusterScene), {
  ssr: false,
  loading: () => null,
});

const PANEL_ID = "cluster-settings";
const LAYERS_ID = "cluster-layers";

interface Hover {
  pick: Pick;
  x: number;
  y: number;
}

/**
 * Build-your-own GPU cluster: settings on the right, the cluster in 3D on
 * the left, rebuilt on every change. Racks and parts can be inspected in the
 * viewport, and the configuration rides along in the URL so it can be shared.
 */
export function ClusterConfigurator({
  initialConfig,
  bom,
}: {
  initialConfig: ClusterConfig;
  /** A deployment phase's BOM, for the ZODE team: its coverage shows in the panel and its gaps in the viewport. */
  bom?: BuilderBom;
}): ReactElement {
  const [config, setConfig] = useState(initialConfig);
  const [copies, setCopies] = useState(bom?.copies ?? 1);
  const [layersOpen, setLayersOpen] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<Layer>>(() => new Set());
  const [cables, setCables] = useState(true);
  const [rail, setRail] = useState<number | null>(null);
  const [focus, setFocus] = useState<Layer | null>(null);
  const [selection, setSelection] = useState<Pick | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [copied, setCopied] = useState(false);
  const viewportRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<ClusterSceneHandle>(null);

  const model = useMemo(() => buildCluster(config), [config]);
  const update = (patch: Partial<ClusterConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const coverage = useMemo(() => (bom ? phaseCoverage(model, copies, bom.items) : null), [bom, model, copies]);
  const flags = useMemo(() => {
    if (!coverage) return null;
    const out = new Map<PartKind, PartFlag>();
    for (const [kind, status] of partStatuses(coverage)) {
      if (status === "missing" || status === "short") out.set(kind, status);
    }
    return out;
  }, [coverage]);

  // A resize or re-pack can take the selected rack or part away; drop what no longer exists.
  const selectedRack = selection ? (model.racks.find((r) => r.id === selection.rackId) ?? null) : null;
  const selectedPart = selectedRack?.parts.find((p) => p.id === selection?.partId)?.id ?? null;
  const selected = useMemo(
    () => (selectedRack ? { rackId: selectedRack.id, partId: selectedPart } : null),
    [selectedRack, selectedPart],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    writeConfigParams(config, url.searchParams);
    window.history.replaceState(null, "", url);
  }, [config]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setSelection(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const toggleLayer = (layer: Layer) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(layer)) next.add(layer);
      return next;
    });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused; the URL bar still holds the link.
    }
  };

  const hovered = hover ? model.racks.find((r) => r.id === hover.pick.rackId) : null;
  const hoveredPart = hover?.pick.partId ? hovered?.parts.find((p) => p.id === hover.pick.partId) : null;
  const platform = PLATFORMS[config.platform];

  return (
    <div className={styles.root}>
      <section ref={viewportRef} className={styles.viewport} data-surface="light" aria-label="Cluster preview">
        <ClusterScene
          ref={sceneRef}
          model={model}
          hidden={hidden}
          cables={cables}
          rail={rail}
          focus={focus}
          selected={selected}
          flags={flags}
          onHover={(pick, x, y) => {
            const box = viewportRef.current?.getBoundingClientRect();
            if (!pick || !box) return setHover(null);
            // Viewport coordinates, the card flipped to the other side of the pointer near an edge.
            const left = x - box.left;
            const top = y - box.top;
            setHover({
              pick,
              x: left > box.width - 260 ? left - 254 : left + 14,
              y: top > box.height - 220 ? top - 84 : top + 14,
            });
          }}
          onSelect={(pick) => setSelection(pick)}
        />

        <header className={styles.head}>
          <p className={styles.eyebrow}>Viewing</p>
          <h2 className={styles.title}>{selectedRack ? selectedRack.name : "Your cluster"}</h2>
          <p className={styles.subtitle}>
            {count(model.stats.gpus)} {platform.short} GPUs · {model.stats.racks} racks in {model.stats.rows} row
            {model.stats.rows === 1 ? "" : "s"}
          </p>
        </header>

        {layersOpen ? (
          <div id={LAYERS_ID} className={styles.layers}>
            <LayersPanel
              hidden={hidden}
              onToggle={toggleLayer}
              onPreview={setFocus}
              cables={cables}
              onCables={setCables}
              rail={rail}
              onRail={setRail}
            />
          </div>
        ) : null}

        <div className={styles.tools}>
          <ViewPresets
            onView={(preset) => sceneRef.current?.setView(preset)}
            layersOpen={layersOpen}
            onLayers={(open) => {
              setLayersOpen(open);
              if (!open) setFocus(null);
            }}
            layersId={LAYERS_ID}
          />
        </div>

        {selectedRack ? (
          <div className={styles.inspector}>
            <RackElevation
              rack={selectedRack}
              partId={selectedPart}
              onSelectPart={(partId) => setSelection({ rackId: selectedRack.id, partId })}
              onClose={() => setSelection(null)}
              partExtra={
                coverage && bom
                  ? (part) => <PartBom rows={slotsForKind(coverage, part.kind)} vendors={bom.vendors} />
                  : undefined
              }
            />
          </div>
        ) : null}

        {hover && hovered ? (
          <div className={styles.hoverCard} style={{ left: hover.x, top: hover.y }} aria-hidden="true">
            <span className={styles.hoverKind}>{hoveredPart ? KIND_LABELS[hoveredPart.kind] : "Cabinet"}</span>
            <strong className={styles.hoverTitle}>{hoveredPart ? hoveredPart.label : hovered.name}</strong>
            <span className={styles.hoverDetail}>
              {hoveredPart
                ? `${hoveredPart.model} · U${hoveredPart.uStart}${hoveredPart.kw ? ` · ${power(hoveredPart.kw)}` : ""}`
                : `${hovered.uHeight}U · ${power(hovered.kw)}`}
            </span>
            {coverage && hoveredPart
              ? slotsForKind(coverage, hoveredPart.kind).map((row) => (
                  <span key={row.slot.id} className={styles.hoverDetail}>
                    {row.slot.label}: {STATUS_LABELS[row.status]}
                  </span>
                ))
              : null}
          </div>
        ) : null}

        <p className={styles.hint} aria-hidden="true">
          Drag to orbit · scroll to zoom · click a rack
        </p>

        <StatsBar model={model} />
      </section>

      <div className={styles.panelFrame}>
        <div className={styles.top}>
          <p className={styles.kicker}>{bom ? "Deployment BOM" : "Resources"}</p>
          <button type="button" className={styles.share} onClick={copyLink}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          <Link
            href={bom ? `/portal/deployments/${bom.deploymentId}` : "/"}
            className={styles.close}
            aria-label={bom ? "Close and return to the deployment" : "Close and return home"}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </Link>
        </div>
        <div className={styles.scrollFrame}>
          <div id={PANEL_ID} className={styles.panel} data-surface="light">
            <header className={styles.intro}>
              <h1 className={styles.heading}>Cluster builder</h1>
              <p className={styles.lede}>
                Size a GPU cluster rack by rack. Every change rebuilds the racks, the switches and the rail-optimized
                fabric beside you.
              </p>
            </header>
            {bom && coverage ? (
              <BomPanel bom={bom} config={config} copies={copies} onCopies={setCopies} coverage={coverage} />
            ) : null}
            <ControlPanel config={config} model={model} update={update} onPreview={setFocus} />
            <p className={styles.disclaimer}>
              Figures come from placeholder specs for planning, not a quote. Facility power and cooling aren&apos;t
              included.{" "}
              <Link href="/talk-to-an-engineer" className={styles.inlineLink}>
                Talk to an engineer
              </Link>
            </p>
          </div>
          <OverlayScrollbar targetId={PANEL_ID} />
        </div>
      </div>
    </div>
  );
}

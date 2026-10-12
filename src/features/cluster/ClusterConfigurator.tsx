"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import { ControlPanel } from "./ControlPanel";
import { count, power } from "./format";
import { buildCluster } from "./model/build";
import { KIND_LABELS, PLATFORMS } from "./model/catalog";
import type { ClusterConfig, Layer } from "./model/types";
import { writeConfigParams } from "./model/url";
import { RackElevation } from "./RackElevation";
import { ClusterScene, type ClusterSceneHandle } from "./scene/ClusterScene";
import type { Pick } from "./scene/ClusterView";
import { StatsBar } from "./StatsBar";
import { LayersPanel, ViewPresets } from "./ViewToolbar";
import styles from "./ClusterConfigurator.module.css";

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
export function ClusterConfigurator({ initialConfig }: { initialConfig: ClusterConfig }): ReactElement {
  const [config, setConfig] = useState(initialConfig);
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
          </div>
        ) : null}

        <p className={styles.hint} aria-hidden="true">
          Drag to orbit · scroll to zoom · click a rack
        </p>

        <StatsBar model={model} />
      </section>

      <div className={styles.panelFrame}>
        <div className={styles.top}>
          <p className={styles.kicker}>Resources</p>
          <button type="button" className={styles.share} onClick={copyLink}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          <Link href="/" className={styles.close} aria-label="Close and return home">
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

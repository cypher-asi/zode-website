"use client";

import type { CSSProperties, ReactElement } from "react";
import { LAYER_LABELS } from "./model/catalog";
import type { Layer } from "./model/types";
import { RAIL_COLORS, RAIL_NAMES } from "./scene/palette";
import type { ViewPreset } from "./scene/ClusterView";
import styles from "./ViewToolbar.module.css";

const LAYERS: readonly Layer[] = ["compute", "network", "storage", "management", "rack"];

const PRESETS: readonly { id: ViewPreset; label: string }[] = [
  { id: "iso", label: "Iso" },
  { id: "front", label: "Front" },
  { id: "top", label: "Top" },
];

/** Layer visibility and the fabric's rails, beside the viewport's heading. */
export function LayersPanel({
  hidden,
  onToggle,
  onPreview,
  cables,
  onCables,
  rail,
  onRail,
}: {
  hidden: ReadonlySet<Layer>;
  onToggle: (layer: Layer) => void;
  onPreview: (layer: Layer | null) => void;
  cables: boolean;
  onCables: (on: boolean) => void;
  rail: number | null;
  onRail: (rail: number | null) => void;
}): ReactElement {
  return (
    <div className={styles.panel}>
      <p className={styles.legend}>Layers</p>
      <ul className={styles.layers}>
        {LAYERS.map((layer) => (
          <li key={layer}>
            <button
              type="button"
              className={styles.layer}
              data-layer={layer}
              aria-pressed={!hidden.has(layer)}
              onClick={() => onToggle(layer)}
              onMouseEnter={() => onPreview(layer)}
              onMouseLeave={() => onPreview(null)}
              onFocus={() => onPreview(layer)}
              onBlur={() => onPreview(null)}
            >
              <span className={styles.swatch} aria-hidden="true" />
              {LAYER_LABELS[layer]}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={styles.layer} data-layer="cables" aria-pressed={cables} onClick={() => onCables(!cables)}>
            <span className={styles.swatch} aria-hidden="true" />
            Fabric cables
          </button>
        </li>
      </ul>
      {cables ? (
        <div className={styles.rails} role="group" aria-label="Highlight one GPU rail">
          {RAIL_COLORS.map((color, i) => (
            <button
              key={color}
              type="button"
              className={styles.rail}
              style={{ "--rail": color } as CSSProperties}
              aria-pressed={rail === i}
              aria-label={`Rail ${i + 1}, ${RAIL_NAMES[i]}`}
              title={`Rail ${i + 1}`}
              onClick={() => onRail(rail === i ? null : i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Camera presets over the viewport's corner. */
export function ViewPresets({ onView }: { onView: (preset: ViewPreset) => void }): ReactElement {
  return (
    <div className={styles.presets} role="group" aria-label="Camera">
      {PRESETS.map((p) => (
        <button key={p.id} type="button" className={styles.preset} onClick={() => onView(p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

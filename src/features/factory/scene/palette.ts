import * as THREE from "three";

/** The scene's colours, read from the portal's tokens so the floor follows its light and dark themes. */
export interface Palette {
  bg: THREE.Color;
  line: THREE.Color;
  detail: THREE.Color;
  infra: THREE.Color;
  infraDetail: THREE.Color;
  grid: THREE.Color;
  marking: THREE.Color;
  accent: THREE.Color;
  stock: THREE.Color;
  /** Per station state, in STATES order. */
  states: THREE.Color[];
}

export function readPalette(el: HTMLElement): Palette {
  const style = getComputedStyle(el);
  const token = (name: string, fallback: string) => new THREE.Color(style.getPropertyValue(name).trim() || fallback);
  const bg = token("--color-bg", "white");
  const accent = token("--color-accent", "orange");
  return {
    bg,
    line: token("--color-ink", "black"),
    detail: token("--color-text-tertiary", "gray"),
    infra: token("--color-text-secondary", "dimgray"),
    infraDetail: token("--color-text-faint", "silver"),
    grid: token("--color-border", "gainsboro"),
    marking: token("--color-border-hover", "darkgray"),
    accent,
    stock: bg.clone().lerp(accent, 0.28),
    states: [
      token("--color-text-faint", "silver"),
      token("--color-warning", "goldenrod"),
      token("--color-info", "royalblue"),
      accent,
      token("--color-danger", "firebrick"),
    ],
  };
}

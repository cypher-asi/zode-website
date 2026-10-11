import * as THREE from "three";
import { fetchCabin, type ParsedCabin } from "./cabinParse";
import type { CabinWorkerMessage } from "./cabinModel.worker";

/*
 * Loads the ZODE / Barnhouse asset from /public as toggleable layers plus a
 * two-weight line drawing (see cabinParse.ts). The ~7.5 MB OBJ is fetched and
 * parsed in a worker so the main thread keeps animating; the result is cached
 * at module scope so the file is only read once.
 */

export interface CabinLayers extends Omit<ParsedCabin, "solids"> {
  /** Per sub-layer solid geometry (flat-shaded triangles), base at y = 0. */
  solids: Record<string, THREE.BufferGeometry>;
}

let cache: Promise<CabinLayers> | null = null;

function parseInWorker(): Promise<ParsedCabin> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./cabinModel.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<CabinWorkerMessage>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.cabin);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
  });
}

async function build(): Promise<CabinLayers> {
  const parsed =
    typeof Worker === "undefined" ? await fetchCabin() : await parseInWorker().catch(() => fetchCabin());
  const solids: CabinLayers["solids"] = {};
  for (const id of parsed.present) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(parsed.solids[id].position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(parsed.solids[id].normal, 3));
    solids[id] = g;
  }
  return { ...parsed, solids };
}

export function loadCabinLayers(): Promise<CabinLayers> {
  if (!cache) cache = build();
  return cache;
}

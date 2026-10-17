/**
 * The line drawings' geometry, free of React so the PDFs can draw with it
 * too: a 2:1 dimetric projection, a seeded PRNG and painter's ordering.
 */

export type P3 = readonly [number, number, number?];

export const round = (n: number) => Math.round(n * 100) / 100;

/** 2:1 dimetric projection; +z is up, +x/+y run toward the viewer's right/left. */
export function project([x, y, z = 0]: P3): [number, number] {
  return [round(x - y), round((x + y) / 2 - z)];
}

/** Maps a model point to screen space; it must keep the +x, +y and +z faces turned toward the viewer. */
export type Projector = (p: P3) => [number, number];

/** Deterministic PRNG so the server and client render identical geometry. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const backToFront = <T extends { x: number; y: number }>(a: T, b: T) => a.x + a.y - (b.x + b.y);

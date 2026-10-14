import type { Spread } from "../model/catalog";

/*
 * A minimal discrete-event core: a clock, a queue of timed callbacks ordered
 * by time (ties in the order they were scheduled), and a seeded random
 * source so a scenario and seed always replay the same run.
 */

interface Event {
  time: number;
  seq: number;
  run: () => void;
}

export class Clock {
  now = 0;
  private heap: Event[] = [];
  private seq = 0;

  at(time: number, run: () => void): void {
    const e = { time, seq: this.seq++, run };
    const h = this.heap;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(h[i], h[parent])) break;
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
    }
  }

  after(delay: number, run: () => void): void {
    this.at(this.now + delay, run);
  }

  /** Runs every event up to `end`, calling `settle` after each so the model can react. */
  run(end: number, settle: () => void): void {
    settle();
    while (this.heap.length && this.heap[0].time <= end) {
      const e = this.pop();
      this.now = e.time;
      e.run();
      settle();
    }
    this.now = end;
  }

  private pop(): Event {
    const h = this.heap;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && before(h[l], h[m])) m = l;
        if (r < h.length && before(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}

const before = (a: Event, b: Event) => a.time < b.time || (a.time === b.time && a.seq < b.seq);

/** mulberry32: small, fast and good enough to drive a factory model. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A draw from the triangular distribution over `spread`. */
export function triangular(random: () => number, [a, c, b]: Spread): number {
  if (b <= a) return a;
  const u = random();
  const f = (c - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

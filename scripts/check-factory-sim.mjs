/**
 * Checks the factory simulation: every compute pod part maps to one
 * material, a fixed-seed run keeps its invariants (one pod per position,
 * stations in order, parts conserved), runs replay exactly, and a
 * deterministic line matches its lead time and throughput worked by hand.
 *
 *   npm run check:factory
 */
import { registerHooks } from "node:module";

// The app's TypeScript imports omit the extension, as the bundler allows.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { COMPUTE_POD, DEFAULT_SCENARIO, MATERIALS, kitOf, materialOf, podBill } = await import(
  "../src/features/factory/model/catalog.ts"
);
const { simulate } = await import("../src/features/factory/sim/simulate.ts");
const { statsAt, STATES } = await import("../src/features/factory/sim/trace.ts");

let failures = 0;
const check = (ok, message) => {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${message}`);
  }
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// --- Catalog --------------------------------------------------------------
for (const step of COMPUTE_POD.steps) {
  for (const part of step.parts) {
    const matches = MATERIALS.filter((m) => m.prefixes.some((p) => part.id.startsWith(p)));
    check(matches.length === 1, `part ${part.id} maps to ${matches.length} materials`);
  }
}
const stationSteps = new Set(DEFAULT_SCENARIO.stations.map((s) => s.step));
for (const step of COMPUTE_POD.steps) check(stationSteps.has(step.id), `no station builds step ${step.id}`);
const partCount = COMPUTE_POD.steps.reduce((n, s) => n + s.parts.length, 0);
const billCount = podBill(DEFAULT_SCENARIO.stations).reduce((a, b) => a + b, 0);
check(billCount === partCount, `bill of materials has ${billCount} units for ${partCount} parts`);
check(materialOf("rack-C01") !== materialOf("rack-NS01"), "compute and network racks are separate materials");

// --- Invariants on the default scenario ----------------------------------
function invariants(trace, label) {
  const { flow, pods, horizon, scenario } = trace;
  // Each position holds at most one pod: from the move in starting to the move out starting.
  const spans = flow.map(() => []);
  for (const pod of pods) {
    pod.moves.forEach((m, i) => {
      if (m.to >= flow.length) return;
      const out = pod.moves[i + 1];
      spans[m.to].push([m.t0, out ? out.t0 : Infinity]);
    });
  }
  spans.forEach((list, k) => {
    list.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < list.length; i++) {
      check(list[i][0] >= list[i - 1][1] - 1e-9, `${label}: position ${k} held two pods at ${list[i][0]}`);
    }
  });
  // Stations in order; each starts only after the pod arrived and the previous one finished.
  for (const pod of pods) {
    for (let s = 0; s < scenario.stations.length; s++) {
      if (Number.isNaN(pod.start[s])) break;
      check(pod.end[s] > pod.start[s], `${label}: pod ${pod.id} station ${s} has no duration`);
      if (s > 0) check(pod.start[s] >= pod.end[s - 1], `${label}: pod ${pod.id} station ${s} starts before ${s - 1} ends`);
    }
    if (pod.done <= horizon) {
      check(pod.start.every((t) => !Number.isNaN(t)), `${label}: pod ${pod.id} finished with stations skipped`);
    }
  }
  // Parts are conserved: start + delivered − used = on hand, never negative.
  const used = MATERIALS.map(() => 0);
  const kits = scenario.stations.map(kitOf);
  for (const trip of trace.kits) kits[trip.station].forEach((n, m) => (used[m] += n));
  trace.stock.forEach((s, m) => {
    let delivered = 0;
    for (let i = 1; i < s.t.length; i++) if (s.onHand[i] > s.onHand[i - 1]) delivered += s.onHand[i] - s.onHand[i - 1];
    check(s.onHand.every((n) => n >= 0), `${label}: ${MATERIALS[m].id} went negative`);
    check(trace.orderUpTo[m] + delivered - used[m] === s.onHand.at(-1), `${label}: ${MATERIALS[m].id} isn't conserved`);
  });
  // Shares of time add up.
  const stats = statsAt(trace, horizon);
  for (const s of stats.stations) check(near(s.shares.reduce((a, b) => a + b, 0), 1), `${label}: shares don't sum to 1`);
  return stats;
}

const base = simulate(DEFAULT_SCENARIO);
const baseStats = invariants(base, "default");
check(baseStats.completed > 0, "default scenario finishes no pods");
const replay = simulate(DEFAULT_SCENARIO);
check(JSON.stringify(replay) === JSON.stringify(base), "the same seed doesn't replay the same run");
const reseeded = simulate({ ...DEFAULT_SCENARIO, seed: 2 });
invariants(reseeded, "seed 2");
check(JSON.stringify(reseeded.pods) !== JSON.stringify(base.pods), "a new seed doesn't change the run");

// --- Worked by hand -------------------------------------------------------
// Every station one fixed hour, no crane, no rework, stock that never runs out.
const fixed = (hours) =>
  DEFAULT_SCENARIO.stations.map((s) => ({ ...s, crew: 1, work: [hours, hours, hours], craneHours: 0, rework: undefined }));
const handBase = { ...DEFAULT_SCENARIO, moveHours: 0.5, kitHours: 0.25, coverPods: 10000, horizonDays: 20 };

// Orders spaced far apart never queue: lead time is every move plus every station.
const sparse = simulate({ ...handBase, stations: fixed(1), releaseEveryHours: 40 });
invariants(sparse, "sparse");
const positions = sparse.flow.length;
const expectedLead = (positions + 1) * 0.5 + DEFAULT_SCENARIO.stations.length * 1;
const sparseStats = statsAt(sparse, sparse.horizon);
check(near(sparseStats.leadHours, expectedLead), `sparse lead time ${sparseStats.leadHours}, expected ${expectedLead}`);

// Saturated, with one slow station: it sets the pace, one pod per cycle plus the move in.
const slow = fixed(1);
slow[4] = { ...slow[4], work: [3, 3, 3] };
const saturated = simulate({ ...handBase, stations: slow, releaseEveryHours: 1 });
invariants(saturated, "saturated");
const ends = saturated.stationEnds[4];
const gaps = ends.slice(10, 40).map((t, i, a) => (i ? t - a[i - 1] : null)).filter((g) => g !== null);
check(gaps.every((g) => near(g, 3.5)), `bottleneck cycle isn't 3.5 h: ${[...new Set(gaps)].join(", ")}`);
const satStats = statsAt(saturated, saturated.horizon);
check(satStats.bottleneck === 4, `bottleneck reported as station ${satStats.bottleneck}`);

if (failures) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
console.log("Factory simulation checks passed.");
console.log(
  `  Default run: ${baseStats.completed} pods in ${DEFAULT_SCENARIO.horizonDays} days, lead time ${fmt(baseStats.leadHours / 24)} days, ` +
    `bottleneck ${DEFAULT_SCENARIO.stations[baseStats.bottleneck].code}.`,
);
console.log(
  `  Busy share: ${baseStats.stations.map((s, i) => `${DEFAULT_SCENARIO.stations[i].code} ${Math.round(s.shares[STATES.indexOf("working")] * 100)}%`).join(", ")}`,
);

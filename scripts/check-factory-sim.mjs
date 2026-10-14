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
const { DAMAGED, HANDLING_OF, RESOURCES, STOCKED, SUPPLIER_OF } = await import("../src/features/factory/sim/inbound.ts");
const { inboundStatsAt } = await import("../src/features/factory/sim/inboundStats.ts");

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
    const delivered = trace.inbound.hus
      .filter((hu) => hu.material === m && hu.outcome === STOCKED && hu.stored <= horizon)
      .reduce((sum, hu) => sum + hu.units, 0);
    check(s.onHand.every((n) => n >= 0), `${label}: ${MATERIALS[m].id} went negative`);
    check(trace.startStock[m] + delivered - used[m] === s.onHand.at(-1), `${label}: ${MATERIALS[m].id} isn't conserved`);
  });
  inboundInvariants(trace.inbound, horizon, label);
  // Shares of time add up.
  const stats = statsAt(trace, horizon);
  for (const s of stats.stations) check(near(s.shares.reduce((a, b) => a + b, 0), 1), `${label}: shares don't sum to 1`);
  return stats;
}

/** Intervals that may not overlap, as [start, end) pairs. */
function exclusive(intervals, message) {
  const sorted = intervals.filter(([a]) => a < Infinity).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) check(sorted[i][0] >= sorted[i - 1][1] - 1e-9, `${message} at ${sorted[i][0]}`);
}

const hourOf = (t) => t - Math.floor(t / 24) * 24;

function inboundInvariants(inbound, horizon, label) {
  const cfg = inbound.config;
  const isOpen = (t) => hourOf(t) >= cfg.opens - 1e-9 && hourOf(t) < cfg.closes;
  const doors = cfg.vanDoors + cfg.flatbedBays;
  // Each truck moves through its stages in order, docks only while the dock is open, and only at a door of its kind.
  for (const tr of inbound.trucks) {
    const stages = [tr.arrive, tr.gateIn, tr.stallAt, tr.docked, tr.ready, tr.unloadEnd, tr.released, tr.departed];
    for (let i = 1; i < stages.length; i++) {
      if (stages[i] === Infinity) break;
      check(stages[i] >= stages[i - 1] - 1e-9, `${label}: truck ${tr.id} stage ${i} comes before stage ${i - 1}`);
    }
    if (tr.docked < Infinity) {
      check(isOpen(tr.docked), `${label}: truck ${tr.id} docked with the dock closed`);
      check((tr.door < cfg.vanDoors ? "van" : "flatbed") === tr.kind, `${label}: truck ${tr.id} on the wrong kind of door`);
    }
    check(tr.hus.length > 0, `${label}: truck ${tr.id} carries nothing`);
    for (let k = 1; k < tr.hus.length; k++) {
      const [a, b] = [inbound.hus[tr.hus[k - 1]], inbound.hus[tr.hus[k]]];
      check(b.unloadStart >= a.unloaded - 1e-9, `${label}: truck ${tr.id} unloaded two HUs at once`);
    }
    if (tr.unloadEnd < Infinity) check(inbound.hus[tr.hus[0]].unloadStart >= tr.ready - 1e-9, `${label}: truck ${tr.id} unloaded before it was ready`);
  }
  // One truck per door and per stall, one HU per staging spot.
  for (let d = 0; d < doors; d++) {
    exclusive(inbound.trucks.filter((tr) => tr.door === d).map((tr) => [tr.docked, tr.departed]), `${label}: door ${d} held two trucks`);
  }
  for (let s = 0; s < cfg.yardStalls; s++) {
    exclusive(inbound.trucks.filter((tr) => tr.stall === s).map((tr) => [tr.stallAt, tr.docked]), `${label}: stall ${s} held two trucks`);
  }
  for (const [area, size] of [[0, cfg.dockStaging], [1, cfg.bayLaydown]]) {
    for (let s = 0; s < size; s++) {
      exclusive(
        inbound.hus.filter((hu) => hu.area === area && hu.slot === s).map((hu) => [hu.unloadStart, hu.putStart]),
        `${label}: staging ${area}/${s} held two HUs`,
      );
    }
    check(inbound.hus.every((hu) => hu.area !== area || hu.slot < size), `${label}: an HU staged past area ${area}'s ${size} spots`);
  }
  // Each HU through its stages in order; QC and put-away start only in dock hours.
  for (const hu of inbound.hus) {
    const after = (a, b, what) => b === Infinity || check(b >= a - 1e-9, `${label}: HU ${hu.id} ${what}`);
    after(hu.unloadStart, hu.unloaded, "unloaded before it started");
    after(hu.unloaded, hu.checked, "checked before it came off");
    after(hu.checked, hu.received, "received before its check");
    after(hu.received, hu.qcStart, "inspected before its receipt");
    after(hu.qcStart, hu.qcEnd, "passed QC before starting it");
    after(hu.inspect ? hu.qcEnd : hu.outcome === DAMAGED ? hu.checked : hu.received, hu.putStart, "put away too early");
    after(hu.putStart, hu.stored, "stored before it moved");
    if (hu.qcStart < Infinity) check(isOpen(hu.qcStart), `${label}: HU ${hu.id} inspected after hours`);
    if (hu.putStart < Infinity) check(isOpen(hu.putStart), `${label}: HU ${hu.id} put away after hours`);
    check(hu.truck >= 0 && inbound.trucks[hu.truck].hus.includes(hu.id - 1), `${label}: HU ${hu.id} isn't on its truck`);
  }
  // Never more of a resource in use than there is.
  const capacity = {
    guard: 1,
    handlers: cfg.handlers,
    forklifts: cfg.forklifts,
    cranes: cfg.flatbedBays,
    clerks: cfg.clerks,
    inspectors: cfg.inspectors,
  };
  for (const r of RESOURCES) {
    const edges = inbound.holds[r].flatMap((h) => [[h.t0, h.n], [h.t1, -h.n]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let inUse = 0;
    let peak = 0;
    for (const [, n] of edges) peak = Math.max(peak, (inUse += n));
    check(peak <= capacity[r], `${label}: ${peak} ${r} in use, ${capacity[r]} on hand`);
  }
  // Every damaged or rejected HU was reordered, once.
  const bad = inbound.hus.filter((hu) => hu.outcome !== STOCKED).length;
  const expedites = inbound.trucks.filter((tr) => tr.expedite).length;
  check(bad === expedites, `${label}: ${bad} HUs failed but ${expedites} replacements shipped`);
  check(inbound.trucks.some((tr) => tr.departed <= horizon), `${label}: no truck was received`);
}

for (const material of MATERIALS) {
  const h = HANDLING_OF[MATERIALS.indexOf(material)];
  check(h >= 0, `${material.id} has no handling`);
  if (h >= 0) check(SUPPLIER_OF[h] >= 0, `${material.id}'s supplier isn't listed`);
}

const base = simulate(DEFAULT_SCENARIO);
const baseStats = invariants(base, "default");
check(baseStats.completed > 0, "default scenario finishes no pods");
const replay = simulate(DEFAULT_SCENARIO);
check(JSON.stringify(replay) === JSON.stringify(base), "the same seed doesn't replay the same run");
const reseeded = simulate({ ...DEFAULT_SCENARIO, seed: 2 });
invariants(reseeded, "seed 2");
// A dock short of everything still keeps every rule, just slower.
const tight = simulate({
  ...DEFAULT_SCENARIO,
  inbound: { ...DEFAULT_SCENARIO.inbound, vanDoors: 1, yardStalls: 2, dockStaging: 6, bayLaydown: 2, clerks: 1, inspectors: 1, forklifts: 1 },
});
invariants(tight, "tight dock");
const baseDock = inboundStatsAt(base.inbound, base.horizon);
const tightDock = inboundStatsAt(tight.inbound, tight.horizon);
check(tightDock.turnHours > baseDock.turnHours, "a smaller dock doesn't turn trucks slower");
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
  `  Dock: ${baseDock.departed} trucks, turned in ${fmt(baseDock.turnHours)} h, dock to stock ${fmt(baseDock.dockToStock)} h, ` +
    `detention $${Math.round(baseDock.detentionHours * DEFAULT_SCENARIO.inbound.detentionRate).toLocaleString("en-US")}.`,
);
console.log(
  `  Busy share: ${baseStats.stations.map((s, i) => `${DEFAULT_SCENARIO.stations[i].code} ${Math.round(s.shares[STATES.indexOf("working")] * 100)}%`).join(", ")}`,
);

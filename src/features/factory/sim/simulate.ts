import { MATERIALS, flowOf, kitOf, podBill, type Scenario } from "../model/catalog";
import { Clock, rng, triangular } from "./engine";
import {
  BLOCKED,
  CRANE,
  IDLE,
  PARTS,
  RECEIVING,
  STATES,
  WORKING,
  type CraneLift,
  type KitTrip,
  type PodTrace,
  type StateSeries,
  type StockSeries,
  type Trace,
} from "./trace";

/*
 * The compute pod line as a discrete-event model. Orders are released on a
 * fixed beat and wait at receiving until the first bay is free. Pods then
 * step position by position, stations and buffer slots alike, each holding
 * one pod; a pod only moves on when the position ahead is clear, so a full
 * lane blocks the station behind it. A station builds once its pod is in,
 * its kit is on the pad and, if it lifts, the shared overhead crane is free.
 * Kits are picked from the store as soon as a pad empties, and the store
 * reorders each material up to a set cover on a fixed review cycle.
 */

interface Live {
  trace: PodTrace;
  /** The position it's at, or moving to. */
  pos: number;
  moving: boolean;
  /** Its work at the current station is done. */
  doneHere: boolean;
}

export function simulate(sc: Scenario): Trace {
  const clock = new Clock();
  const random = rng(sc.seed);
  const horizon = sc.horizonDays * 24;
  const flow = flowOf(sc.stations);
  const yard = flow.length;
  const stationPos = sc.stations.map((_, i) => flow.findIndex((f) => f.kind === "station" && f.station === i));
  const kits = sc.stations.map(kitOf);
  const needsKit = kits.map((kit) => kit.some((n) => n > 0));
  const bill = podBill(sc.stations);
  const orderUpTo = bill.map((n) => n * sc.coverPods);
  const onHand = [...orderUpTo];
  const onOrder = bill.map(() => 0);
  const K = STATES.length;

  const occupant: (Live | null)[] = flow.map(() => null);
  const pods: PodTrace[] = [];
  const releases: number[] = [];
  const doneTimes: number[] = [];
  const kitTrips: KitTrip[] = [];
  const lifts: CraneLift[] = [];
  const stock: StockSeries[] = onHand.map((n) => ({ t: [0], onHand: [n] }));
  const series: StateSeries[] = sc.stations.map(() => ({ t: [0], state: [IDLE], cum: new Array(K).fill(0) }));
  const station = sc.stations.map((_, i) => ({ busy: false, kit: !needsKit[i], inbound: false, trip: -1 }));
  let craneFree = true;
  let backlog = 0;

  const setStock = (m: number, n: number) => {
    onHand[m] = n;
    const s = stock[m];
    if (s.t[s.t.length - 1] === clock.now) s.onHand[s.onHand.length - 1] = n;
    else {
      s.t.push(clock.now);
      s.onHand.push(n);
    }
  };

  const record = (i: number, state: number) => {
    const se = series[i];
    let n = se.t.length;
    if (se.state[n - 1] === state) return;
    if (se.t[n - 1] === clock.now) {
      // The last state lasted no time: replace it.
      if (n === 1) {
        se.state[0] = state;
        return;
      }
      se.t.pop();
      se.state.pop();
      se.cum.length -= K;
      n--;
      if (se.state[n - 1] === state) return;
    }
    const prevT = se.t[n - 1];
    const prevS = se.state[n - 1];
    for (let k = 0; k < K; k++) se.cum.push(se.cum[(n - 1) * K + k] + (k === prevS ? clock.now - prevT : 0));
    se.t.push(clock.now);
    se.state.push(state);
  };

  const stateOf = (i: number) => {
    const pod = occupant[stationPos[i]];
    if (!pod || pod.moving) return IDLE;
    if (pod.doneHere) return BLOCKED;
    if (station[i].busy) return WORKING;
    if (!station[i].kit) return PARTS;
    return CRANE;
  };

  const move = (pod: Live, to: number) => {
    if (pod.pos >= 0) occupant[pod.pos] = null;
    if (to < yard) occupant[to] = pod;
    const t1 = clock.now + sc.moveHours;
    pod.trace.moves.push({ from: pod.pos, to, t0: clock.now, t1 });
    pod.pos = to;
    pod.moving = true;
    pod.doneHere = false;
    clock.at(t1, () => {
      pod.moving = false;
      if (to === yard) {
        pod.trace.done = clock.now;
        doneTimes.push(clock.now);
      }
    });
  };

  const enter = () => {
    const n = sc.stations.length;
    const trace: PodTrace = {
      id: pods.length + 1,
      released: releases[pods.length],
      moves: [],
      start: new Array(n).fill(NaN),
      end: new Array(n).fill(NaN),
      reworked: new Array(n).fill(false),
      done: NaN,
    };
    pods.push(trace);
    backlog--;
    move({ trace, pos: RECEIVING, moving: false, doneHere: false }, 0);
  };

  const build = (i: number, pod: Live) => {
    const s = sc.stations[i];
    const st = station[i];
    st.busy = true;
    if (needsKit[i]) {
      st.kit = false;
      kitTrips[st.trip].used = clock.now;
    }
    let hours = triangular(random, s.work) / s.crew;
    if (s.rework && random() < s.rework.chance) {
      hours += triangular(random, s.rework.work) / s.crew;
      pod.trace.reworked[i] = true;
    }
    if (s.craneHours > 0) {
      craneFree = false;
      const t1 = clock.now + Math.min(s.craneHours, hours);
      lifts.push({ station: i, t0: clock.now, t1 });
      clock.at(t1, () => (craneFree = true));
    }
    pod.trace.start[i] = clock.now;
    pod.trace.end[i] = clock.now + hours;
    clock.after(hours, () => {
      st.busy = false;
      pod.doneHere = true;
    });
  };

  const pick = (i: number) => {
    const st = station[i];
    kits[i].forEach((n, m) => n && setStock(m, onHand[m] - n));
    st.inbound = true;
    const trip = kitTrips.push({ station: i, t0: clock.now, t1: clock.now + sc.kitHours, used: Infinity }) - 1;
    clock.after(sc.kitHours, () => {
      st.inbound = false;
      st.kit = true;
      st.trip = trip;
    });
  };

  const settle = () => {
    let changed = true;
    while (changed) {
      changed = false;
      // Downstream first, so a lane closes up in one pass.
      for (let k = flow.length - 1; k >= 0; k--) {
        const pod = occupant[k];
        if (!pod || pod.moving) continue;
        if (flow[k].kind === "station" && !pod.doneHere) continue;
        if (k + 1 < yard && occupant[k + 1]) continue;
        move(pod, k + 1);
        changed = true;
      }
      if (backlog > 0 && !occupant[0]) {
        enter();
        changed = true;
      }
      sc.stations.forEach((s, i) => {
        const pod = occupant[stationPos[i]];
        const st = station[i];
        if (!pod || pod.moving || pod.doneHere || st.busy || !st.kit) return;
        if (s.craneHours > 0 && !craneFree) return;
        build(i, pod);
        changed = true;
      });
      // Upstream stations pick first when stock is short.
      sc.stations.forEach((_, i) => {
        const st = station[i];
        if (st.kit || st.inbound || !kits[i].every((n, m) => onHand[m] >= n)) return;
        pick(i);
        changed = true;
      });
    }
    sc.stations.forEach((_, i) => record(i, stateOf(i)));
  };

  for (let k = 0; k * sc.releaseEveryHours < horizon; k++) {
    clock.at(k * sc.releaseEveryHours, () => {
      releases.push(clock.now);
      backlog++;
    });
  }
  for (let k = 1; k * sc.reviewHours <= horizon; k++) {
    clock.at(k * sc.reviewHours, () => {
      bill.forEach((_, m) => {
        const qty = orderUpTo[m] - onHand[m] - onOrder[m];
        if (qty <= 0) return;
        onOrder[m] += qty;
        clock.after(MATERIALS[m].leadHours, () => {
          onOrder[m] -= qty;
          setStock(m, onHand[m] + qty);
        });
      });
    });
  }

  clock.run(horizon, settle);

  const leadSum: number[] = [];
  const buildSum: number[] = [];
  pods.forEach((p) => {
    if (!(p.done <= horizon)) return;
    const n = leadSum.length;
    leadSum.push((n ? leadSum[n - 1] : 0) + p.done - p.released);
    buildSum.push((n ? buildSum[n - 1] : 0) + p.done - p.moves[0].t0);
  });

  return {
    scenario: sc,
    flow,
    horizon,
    pods,
    releases,
    starts: pods.map((p) => p.moves[0].t0),
    doneTimes,
    leadSum,
    buildSum,
    stations: series,
    stationEnds: sc.stations.map((_, i) =>
      pods
        .map((p) => p.end[i])
        .filter((t) => t <= horizon)
        .sort((a, b) => a - b),
    ),
    stock,
    orderUpTo,
    kits: kitTrips,
    crane: lifts,
  };
}

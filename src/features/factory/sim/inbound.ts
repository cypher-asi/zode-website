import { MATERIALS, type Spread } from "../model/catalog";
import {
  HANDLING,
  SLOT_HOURS,
  SUPPLIERS,
  TRUCK_MINUTES,
  supplierIndex,
  type InboundConfig,
  type TruckKind,
} from "../model/inbound";
import { rng, triangular, type Clock } from "./engine";

/*
 * The receiving dock as a discrete-event model on the line's clock. Each
 * reorder becomes one purchase order per supplier, packed into truckloads of
 * whole handling units (HUs). A truck books the first appointment slot its
 * lead time allows and turns up early or late against it; the guard checks
 * it in around the clock, and it waits in a yard stall (or at the gate, once
 * the stalls are full) until a door of its kind is free and the dock is open.
 *
 * On the door, one HU at a time comes off to a free staging spot: a handler
 * on a forklift for vans, the bay's crane with an operator and a rigger for
 * flatbeds. The clerk checks each HU against the BOL (damage goes to MRB and
 * is reordered at once), signs the BOL when the truck is empty and checked,
 * and posts receipts; QC inspects its sample; then a handler puts the HU
 * away, which is when its units reach the store. Trucks already on a door at
 * close are finished out on overtime; everything else waits for the morning.
 */

export const STOCKED = 0;
export const DAMAGED = 1;
export const REJECTED = 2;

export interface TruckTrace {
  /** Serial number, from 1. */
  id: number;
  supplier: number;
  kind: TruckKind;
  /** A hot-shot carrying a replacement for a damaged or rejected HU. */
  expedite: boolean;
  ordered: number;
  appointment: number;
  arrive: number;
  /** Checked in by the guard. */
  gateIn: number;
  /** Its yard stall, or -1 if it went to a door from the gate. */
  stall: number;
  /** When it reached its stall, or left the gate for a door. */
  stallAt: number;
  /** Index into the doors (vans' first, then the flatbed bays), or -1. */
  door: number;
  /** Left for its door. */
  docked: number;
  /** Restrained (and untarped): the first HU can come off. */
  ready: number;
  unloadEnd: number;
  /** BOL signed. */
  released: number;
  /** Off the door and out. */
  departed: number;
  /** Indices into `hus`, in unloading order. */
  hus: number[];
}

export interface HuTrace {
  id: number;
  truck: number;
  material: number;
  /** Index into HANDLING. */
  handling: number;
  units: number;
  /** 0: dock staging behind the doors, 1: the flatbed bay's laydown. */
  area: number;
  slot: number;
  /** Pulled for incoming inspection (decided at receipt). */
  inspect: boolean;
  outcome: number;
  unloadStart: number;
  unloaded: number;
  checked: number;
  received: number;
  qcStart: number;
  qcEnd: number;
  putStart: number;
  stored: number;
}

export const RESOURCES = ["guard", "handlers", "forklifts", "cranes", "clerks", "inspectors"] as const;
export type Resource = (typeof RESOURCES)[number];

/** `n` of a resource held from `t0` to `t1`, for an HU or a truck (-1 if neither). */
export interface Hold {
  t0: number;
  t1: number;
  n: number;
  hu: number;
  truck: number;
}

export interface PurchaseOrder {
  t: number;
  supplier: number;
  lines: { material: number; units: number }[];
  trucks: number[];
  expedite: boolean;
}

export interface InboundTrace {
  config: InboundConfig;
  /** In the order they were shipped; `id` is index + 1. */
  trucks: TruckTrace[];
  hus: HuTrace[];
  holds: Record<Resource, Hold[]>;
  orders: PurchaseOrder[];
}

export interface Inbound {
  /**
   * Orders these units per material, or records an order placed `ago` hours
   * before now and still on its way; returns the units actually ordered,
   * rounded up to whole HUs.
   */
  order(qty: readonly number[], ago?: number): number[];
  /** Starts whatever work the dock can start now. */
  settle(): void;
  finish(): InboundTrace;
}

/** Per MATERIALS index, its HANDLING index; per HANDLING index, its SUPPLIERS index. */
export const HANDLING_OF = MATERIALS.map((m) => HANDLING.findIndex((h) => h.material === m.id));
export const SUPPLIER_OF = HANDLING.map((h) => supplierIndex(h.supplier));

type Needs = [Resource, number][];

export function createInbound(
  clock: Clock,
  cfg: InboundConfig,
  seed: number,
  horizon: number,
  stock: (material: number, units: number) => void,
): Inbound {
  // Its own stream, so the dock's draws never shift the line's.
  const random = rng(seed * 7919 + 17);
  const draw = (minutes: Spread) => triangular(random, minutes) / 60;

  const trucks: TruckTrace[] = [];
  const hus: HuTrace[] = [];
  const orders: PurchaseOrder[] = [];
  const holds = Object.fromEntries(RESOURCES.map((r) => [r, [] as Hold[]])) as Record<Resource, Hold[]>;
  const free: Record<Resource, number> = {
    guard: 1,
    handlers: cfg.handlers,
    forklifts: cfg.forklifts,
    cranes: cfg.flatbedBays,
    clerks: cfg.clerks,
    inspectors: cfg.inspectors,
  };

  const doors: (number | null)[] = new Array(cfg.vanDoors + cfg.flatbedBays).fill(null);
  const stalls: boolean[] = new Array(cfg.yardStalls).fill(false);
  const slots: boolean[][] = [new Array(cfg.dockStaging).fill(false), new Array(cfg.bayLaydown).fill(false)];
  const used = [0, 0];
  const booked = new Map<string, number>();

  const live: {
    next: number;
    unloading: boolean;
    checked: number;
    signing: boolean;
    ready: boolean;
  }[] = [];
  const atGate: number[] = [];
  const waiting: number[] = [];
  const unchecked: number[] = [];
  const toReceive: number[] = [];
  const toInspect: number[] = [];
  const toPut: number[] = [];

  const doorKind = (d: number): TruckKind => (d < cfg.vanDoors ? "van" : "flatbed");
  const isOpen = () => {
    const hour = clock.now - Math.floor(clock.now / 24) * 24;
    return hour >= cfg.opens && hour < cfg.closes;
  };
  const canHold = (needs: Needs) => needs.every(([r, n]) => free[r] >= n);
  const hold = (needs: Needs, hours: number, hu: number, truck: number, done: () => void) => {
    for (const [r, n] of needs) {
      free[r] -= n;
      holds[r].push({ t0: clock.now, t1: clock.now + hours, n, hu, truck });
    }
    clock.after(hours, () => {
      for (const [r, n] of needs) free[r] += n;
      done();
    });
  };
  const forklift: Needs = [
    ["handlers", 1],
    ["forklifts", 1],
  ];
  const crane: Needs = [
    ["handlers", cfg.craneCrew],
    ["cranes", 1],
  ];

  /** The first open slot at or after `target` with a door of its kind still unbooked. */
  const book = (kind: TruckKind, target: number): number => {
    const len = SLOT_HOURS[kind];
    const doorsOfKind = kind === "van" ? cfg.vanDoors : cfg.flatbedBays;
    const last = Math.max(cfg.opens, cfg.closes - 1 - len);
    for (let day = Math.max(0, Math.floor(target / 24)); ; day++) {
      for (let h = cfg.opens; h <= last; h += len) {
        const t = day * 24 + h;
        if (t < target) continue;
        const key = `${kind}${t}`;
        const n = booked.get(key) ?? 0;
        if (n < doorsOfKind) {
          booked.set(key, n + 1);
          return t;
        }
      }
    }
  };

  const newHu = (material: number, units: number): number => {
    const handling = HANDLING_OF[material];
    hus.push({
      id: hus.length + 1,
      truck: -1,
      material,
      handling,
      units,
      area: SUPPLIERS[SUPPLIER_OF[handling]].truck === "van" ? 0 : 1,
      slot: -1,
      inspect: false,
      outcome: STOCKED,
      unloadStart: Infinity,
      unloaded: Infinity,
      checked: Infinity,
      received: Infinity,
      qcStart: Infinity,
      qcEnd: Infinity,
      putStart: Infinity,
      stored: Infinity,
    });
    return hus.length - 1;
  };

  const ship = (supplier: number, load: number[], expedite: boolean, ordered: number, due: number): number => {
    const s = SUPPLIERS[supplier];
    const index = trucks.length;
    const appointment = book(s.truck, Math.max(clock.now, due));
    const arrive = Math.max(clock.now, appointment + triangular(random, s.arrival));
    trucks.push({
      id: index + 1,
      supplier,
      kind: s.truck,
      expedite,
      ordered,
      appointment,
      arrive,
      gateIn: Infinity,
      stall: -1,
      stallAt: Infinity,
      door: -1,
      docked: Infinity,
      ready: Infinity,
      unloadEnd: Infinity,
      released: Infinity,
      departed: Infinity,
      hus: load,
    });
    for (const h of load) hus[h].truck = index;
    live.push({
      next: 0,
      unloading: false,
      checked: 0,
      signing: false,
      ready: false,
    });
    clock.at(arrive, () => atGate.push(index));
    return index;
  };

  const replace = (from: HuTrace) => {
    const supplier = SUPPLIER_OF[from.handling];
    const h = newHu(from.material, from.units);
    const truck = ship(supplier, [h], true, clock.now, clock.now + SUPPLIERS[supplier].leadHours * cfg.expedite);
    orders.push({
      t: clock.now,
      supplier,
      lines: [{ material: from.material, units: from.units }],
      trucks: [truck],
      expedite: true,
    });
  };

  const checkIn = (index: number) =>
    hold([["guard", 1]], draw(TRUCK_MINUTES.gate), -1, index, () => {
      trucks[index].gateIn = clock.now;
      waiting.push(index);
    });

  const dock = (index: number, door: number) => {
    const tr = trucks[index];
    waiting.splice(waiting.indexOf(index), 1);
    if (tr.stall >= 0) stalls[tr.stall] = false;
    if (tr.stallAt === Infinity) tr.stallAt = clock.now;
    doors[door] = index;
    tr.door = door;
    tr.docked = clock.now;
    const hours = draw(TRUCK_MINUTES.dock) + (tr.kind === "flatbed" ? draw(TRUCK_MINUTES.untarp) : 0);
    clock.after(hours, () => {
      tr.ready = clock.now;
      live[index].ready = true;
    });
  };

  const unload = (index: number) => {
    const tr = trucks[index];
    const state = live[index];
    const h = tr.hus[state.next++];
    const hu = hus[h];
    hu.slot = slots[hu.area].indexOf(false);
    slots[hu.area][hu.slot] = true;
    used[hu.area]++;
    hu.unloadStart = clock.now;
    state.unloading = true;
    hold(tr.kind === "van" ? forklift : crane, draw(HANDLING[hu.handling].unload), h, index, () => {
      hu.unloaded = clock.now;
      state.unloading = false;
      unchecked.push(h);
      if (state.next === tr.hus.length) tr.unloadEnd = clock.now;
    });
  };

  const putNeeds = (hu: HuTrace): Needs => (HANDLING[hu.handling].putawayWith === "crane" ? crane : forklift);

  const putAway = (k: number) => {
    const h = toPut.splice(k, 1)[0];
    const hu = hus[h];
    hu.putStart = clock.now;
    slots[hu.area][hu.slot] = false;
    used[hu.area]--;
    hold(putNeeds(hu), draw(HANDLING[hu.handling].putaway), h, hu.truck, () => {
      hu.stored = clock.now;
      if (hu.outcome === STOCKED) stock(hu.material, hu.units);
    });
  };

  const sign = (index: number) => {
    const tr = trucks[index];
    live[index].signing = true;
    hold([["clerks", 1]], draw(TRUCK_MINUTES.bol), -1, index, () => {
      tr.released = clock.now;
      clock.after(draw(TRUCK_MINUTES.pullOut), () => {
        tr.departed = clock.now;
        doors[tr.door] = null;
      });
    });
  };

  const check = (h: number) => {
    const hu = hus[h];
    hold([["clerks", 1]], draw(HANDLING[hu.handling].check), h, hu.truck, () => {
      hu.checked = clock.now;
      live[hu.truck].checked++;
      if (random() < HANDLING[hu.handling].damage) {
        hu.outcome = DAMAGED;
        toPut.push(h);
        replace(hu);
      } else toReceive.push(h);
    });
  };

  const receive = (h: number) => {
    const hu = hus[h];
    hold([["clerks", 1]], draw(HANDLING[hu.handling].receipt), h, hu.truck, () => {
      hu.received = clock.now;
      hu.inspect = random() < HANDLING[hu.handling].inspect.share;
      (hu.inspect ? toInspect : toPut).push(h);
    });
  };

  const inspect = (h: number) => {
    const hu = hus[h];
    hu.qcStart = clock.now;
    hold([["inspectors", 1]], draw(HANDLING[hu.handling].inspect.minutes), h, hu.truck, () => {
      hu.qcEnd = clock.now;
      if (random() < HANDLING[hu.handling].inspect.reject) {
        hu.outcome = REJECTED;
        replace(hu);
      }
      toPut.push(h);
    });
  };

  const onDoor = (index: number) => {
    const tr = trucks[index];
    return tr.door >= 0 && tr.released === Infinity;
  };

  /** The clerk signs off emptied trucks first, then checks what's come off, then posts receipts. */
  const clerkJob = (overtime: boolean): boolean => {
    for (const index of doors) {
      if (index === null) continue;
      const tr = trucks[index];
      const state = live[index];
      if (!state.signing && tr.unloadEnd <= clock.now && state.checked === tr.hus.length) {
        sign(index);
        return true;
      }
    }
    const k = overtime ? unchecked.findIndex((h) => onDoor(hus[h].truck)) : unchecked.length ? 0 : -1;
    if (k >= 0) {
      check(unchecked.splice(k, 1)[0]);
      return true;
    }
    if (!overtime && toReceive.length) {
      receive(toReceive.shift()!);
      return true;
    }
    return false;
  };

  /** Unloading keeps the doors turning; once staging passes its high-water mark, put-away clears it first. */
  const handlerJob = (overtime: boolean): boolean => {
    const tryUnload = () => {
      let best = -1;
      for (const index of doors) {
        if (index === null) continue;
        const tr = trucks[index];
        const state = live[index];
        if (!state.ready || state.unloading || state.next >= tr.hus.length) continue;
        if (used[hus[tr.hus[state.next]].area] >= slots[hus[tr.hus[state.next]].area].length) continue;
        if (!canHold(tr.kind === "van" ? forklift : crane)) continue;
        if (best < 0 || tr.docked < trucks[best].docked) best = index;
      }
      if (best < 0) return false;
      unload(best);
      return true;
    };
    const tryPut = () => {
      if (overtime) return false;
      const k = toPut.findIndex((h) => canHold(putNeeds(hus[h])));
      if (k < 0) return false;
      putAway(k);
      return true;
    };
    const capacity = cfg.dockStaging + cfg.bayLaydown;
    const full = capacity > 0 && (used[0] + used[1]) / capacity >= cfg.highWater;
    return full ? tryPut() || tryUnload() : tryUnload() || tryPut();
  };

  // Something has to happen at opening for the dock to notice it's open.
  for (let day = 0; day * 24 < horizon; day++) clock.at(day * 24 + cfg.opens, () => {});

  return {
    order(qty, ago = 0) {
      const at = clock.now - ago;
      const placed = MATERIALS.map(() => 0);
      SUPPLIERS.forEach((s, supplier) => {
        const lines: { material: number; units: number }[] = [];
        const loads: number[][] = [];
        let share = Infinity;
        MATERIALS.forEach((_, m) => {
          const handling = HANDLING[HANDLING_OF[m]];
          if (SUPPLIER_OF[HANDLING_OF[m]] !== supplier || !(qty[m] > 0)) return;
          const count = Math.ceil(qty[m] / handling.perHu);
          placed[m] = count * handling.perHu;
          lines.push({ material: m, units: placed[m] });
          for (let k = 0; k < count; k++) {
            const each = 1 / handling.perTruck;
            if (share + each > 1 + 1e-9) {
              loads.push([]);
              share = 0;
            }
            loads[loads.length - 1].push(newHu(m, handling.perHu));
            share += each;
          }
        });
        if (!lines.length) return;
        const ids = loads.map((load, k) =>
          ship(supplier, load, false, at, at + s.leadHours + Math.floor(k / s.perDay) * 24),
        );
        orders.push({ t: at, supplier, lines, trucks: ids, expedite: false });
      });
      return placed;
    },

    settle() {
      while (free.guard > 0 && atGate.length) checkIn(atGate.shift()!);
      const open = isOpen();
      if (open) {
        doors.forEach((occupant, d) => {
          if (occupant !== null) return;
          let best = -1;
          for (const index of waiting) {
            const tr = trucks[index];
            if (tr.kind === doorKind(d) && (best < 0 || tr.appointment < trucks[best].appointment)) best = index;
          }
          if (best >= 0) dock(best, d);
        });
      }
      for (const index of waiting) {
        const tr = trucks[index];
        if (tr.stall >= 0) continue;
        const s = stalls.indexOf(false);
        if (s < 0) break;
        stalls[s] = true;
        tr.stall = s;
        tr.stallAt = clock.now;
      }
      while (free.clerks > 0 && clerkJob(!open));
      while (free.handlers > 0 && handlerJob(!open));
      while (open && free.inspectors > 0 && toInspect.length) inspect(toInspect.shift()!);
    },

    finish() {
      return { config: cfg, trucks, hus, holds, orders };
    },
  };
}

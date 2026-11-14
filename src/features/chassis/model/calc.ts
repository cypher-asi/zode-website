import type {
  BomArea,
  BomItem,
  DesignData,
  Part,
  Pod,
  RackType,
  RoofProfile,
  Slot,
} from "@/features/chassis/model/schema";
import { fmt, fmtN, type Vars } from "@/features/chassis/model/format";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface BomLine extends BomItem {
  part: Part | undefined;
  unitCost: number;
  total: number;
  basis: string;
}

export interface RackInstance {
  id: string;
  index: number;
  tap: string;
  type: RackType;
  /** Interior x of the bay's left edge, mm from inner wall. */
  x: number;
  kw: number;
}

export interface BankPower {
  bank: "A" | "B";
  breakers: number[];
  designAmps: number;
  kVA: number;
  kW: number;
}

export interface RackPower {
  rack: RackInstance;
  banks: BankPower[];
  tapAmps: number;
  breakerSum: number;
}

export interface UAudit {
  typeId: string;
  assigned: number;
  overlaps: string[];
  outOfRange: string[];
  free: number[];
  byKind: Record<string, { count: number; units: number }>;
}

export type CheckStatus = "pass" | "fail" | "warn" | "info";

export interface Check {
  id: string;
  group: string;
  label: string;
  value: string;
  status: CheckStatus;
  detail?: string;
  ref?: string;
}

export interface PodPosition {
  pod: Pod;
  x: number;
  roof: RoofProfile | undefined;
}

export interface Clearance {
  label: string;
  value: number;
  text: string;
}

export interface Derived {
  partsById: Map<string, Part>;
  bomById: Map<string, BomItem>;
  bomByPart: Map<string, BomItem[]>;
  rackTypes: Map<string, RackType>;
  racks: RackInstance[];
  bom: {
    lines: BomLine[];
    areaTotals: Record<BomArea, number>;
    total: number;
    uniqueIds: number;
  };
  uAudit: UAudit[];
  power: {
    racks: RackPower[];
    byType: Map<string, RackPower>;
    pdus: { vertical: number; horizontal: number; total: number; byPart: Map<string, number> };
    taps: number;
    busKw: number;
    busLoadKw: number;
  };
  thermal: {
    computeKw: number;
    centralKw: number;
    totalKw: number;
    dtcKw: number;
    computeAirKw: number;
    rdhxLoadKw: number;
    rdhxCapacityKw: number;
    roofCount: number;
    roofReqKw: number;
    roofMarginKw: number;
    fansPerRoof: number;
    airflowRoofM3h: number;
    airflowRoofM3s: number;
    airHeatRoofKw: number;
    coilFaceM2: number;
    coilVelocity: number;
    airflowNeededM3h: number;
    airflowPerFanM3h: number;
    liquidLps: number;
    liquidPairLps: number;
    fanKwRoof: number;
  };
  geometry: {
    wall: number;
    clearL: number;
    clearW: number;
    bayRow: number;
    bayLength: number;
    bayStack: number;
    usableRack: number;
    tapRail: number;
    roofLen: number;
    roofWid: number;
    rowLength: number;
    bodyLength: number;
    transportHeight: number;
    deployedHeight: number;
    rearNode: number;
    rearCdu: number;
    aheadNode: number;
    aheadCdu: number;
  };
  clearances: Clearance[];
  pods: PodPosition[];
  placed: Map<string, number>;
  shellTotals: Record<string, number>;
  checks: Check[];
  vars: Vars;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const AREAS: BomArea[] = ["compute", "cooling", "electrical", "outdoor"];

function inc(map: Map<string, number>, key: string | null | undefined, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
}

export function ampsOf(part: Part | undefined): number {
  const a = part?.ratings?.amps;
  return typeof a === "number" ? a : 0;
}

export function uRange(s: Slot): string {
  const end = s.uStart + s.uHeight - 1;
  return s.uHeight === 1
    ? `U${String(s.uStart).padStart(2, "0")}`
    : `U${String(s.uStart).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
}

export function auditRack(type: RackType, units: number): UAudit {
  const owner: (string | null)[] = Array(units + 1).fill(null);
  const overlaps: string[] = [];
  const outOfRange: string[] = [];
  const byKind: UAudit["byKind"] = {};
  let assigned = 0;
  for (const s of type.slots) {
    const k = (byKind[s.kind] ??= { count: 0, units: 0 });
    k.count += 1;
    k.units += s.uHeight;
    for (let u = s.uStart; u < s.uStart + s.uHeight; u++) {
      if (u < 1 || u > units) {
        outOfRange.push(`${s.label} @U${u}`);
        continue;
      }
      if (owner[u]) overlaps.push(`U${u}: ${owner[u]} / ${s.label}`);
      else {
        owner[u] = s.label;
        assigned++;
      }
    }
  }
  const free: number[] = [];
  for (let u = 1; u <= units; u++) if (!owner[u]) free.push(u);
  return { typeId: type.id, assigned, overlaps, outOfRange, free, byKind };
}

/* ------------------------------------------------------------------ */
/* derive()                                                            */
/* ------------------------------------------------------------------ */

export function derive(data: DesignData): Derived {
  const { parts, bom, pods, racks, electrical, cooling, site } = data;
  const partsById = new Map(parts.parts.map((p) => [p.partId, p]));
  const bomById = new Map(bom.items.map((b) => [b.id, b]));
  const bomByPart = new Map<string, BomItem[]>();
  for (const b of bom.items) bomByPart.set(b.partId, [...(bomByPart.get(b.partId) ?? []), b]);
  const rackTypes = new Map(racks.types.map((t) => [t.id, t]));
  const bay = racks.bay;
  const ch = pods.chassis;
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  /* ---------- BOM ---------- */
  const lines: BomLine[] = bom.items.map((b) => {
    const part = partsById.get(b.partId);
    const unitCost = b.unitCostOverride ?? part?.unitCost ?? 0;
    return { ...b, part, unitCost, total: unitCost * b.qty, basis: part?.costBasis ?? "-" };
  });
  const areaTotals = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<BomArea, number>;
  for (const l of lines) areaTotals[l.area] += l.total;
  const total = lines.reduce((s, l) => s + l.total, 0);
  const ids = new Set(bom.items.map((b) => b.id));

  /* ---------- Racks ---------- */
  const rackList: RackInstance[] = racks.racks.map((r, index) => {
    const type = rackTypes.get(r.type);
    if (!type) throw new Error(`Rack ${r.id} references unknown type ${r.type}`);
    return { id: r.id, index, tap: r.tap, type, x: bay.endClearance + index * bay.pitch, kw: type.kwCap };
  });

  const uAudit = racks.types.map((t) => auditRack(t, bay.units));

  /* ---------- Power ---------- */
  const sys = electrical.system;
  const bankPower = (type: RackType, bank: "A" | "B"): BankPower => {
    const breakers = [
      ...type.zeroU.filter((z) => z.bank === bank).map((z) => ampsOf(partsById.get(z.part))),
      ...type.slots.filter((s) => s.kind === "pdu" && s.bank === bank).map((s) => ampsOf(partsById.get(s.part ?? ""))),
    ].sort((a, b) => b - a);
    const designAmps = breakers.reduce((s, a) => s + a * sys.continuousFactor, 0);
    const kVA = (Math.sqrt(sys.phases) * sys.vLL * designAmps) / 1000;
    return { bank, breakers, designAmps, kVA, kW: kVA * sys.pf };
  };
  const rackPower: RackPower[] = rackList.map((rack) => {
    const banks = [bankPower(rack.type, "A"), bankPower(rack.type, "B")];
    return { rack, banks, tapAmps: rack.type.tapAmps, breakerSum: banks[0].breakers.reduce((s, a) => s + a, 0) };
  });
  const byType = new Map<string, RackPower>();
  for (const rp of rackPower) if (!byType.has(rp.rack.type.id)) byType.set(rp.rack.type.id, rp);

  const pduByPart = new Map<string, number>();
  let vertical = 0;
  let horizontal = 0;
  for (const r of rackList) {
    for (const z of r.type.zeroU) {
      vertical++;
      inc(pduByPart, z.part);
    }
    for (const s of r.type.slots)
      if (s.kind === "pdu") {
        horizontal++;
        inc(pduByPart, s.part);
      }
  }

  /* ---------- Placed instance counts (model -> BOM consistency) ---------- */
  const placed = new Map<string, number>();
  for (const r of rackList) {
    inc(placed, r.type.frame);
    inc(placed, r.type.rdhx);
    for (const s of r.type.slots) inc(placed, s.part);
    for (const z of r.type.zeroU) inc(placed, z.part);
    for (const k of r.type.kits) inc(placed, k.part, k.qty);
  }
  inc(placed, "busway-tap", rackList.length * 2);
  const roofById = new Map(pods.roofProfiles.map((p) => [p.id, p]));
  for (const pod of pods.pods) {
    inc(placed, bomById.get(pod.shellBom)?.partId);
    const roof = roofById.get(pod.roof.profile);
    if (!roof) continue;
    for (const k of roof.kits) inc(placed, k.part, k.qty);
    if (roof.fanPart) inc(placed, roof.fanPart, roof.fanRows * roof.fanCols);
  }
  for (const c of cooling.components) if (c.qty > 0) inc(placed, c.part ?? bomById.get(c.bom ?? "")?.partId, c.qty);
  for (const e of site.equipment) inc(placed, bomById.get(e.bom ?? "")?.partId);

  /* ---------- Thermal ---------- */
  const computeKw = rackList.filter((r) => r.type.role === "compute").reduce((s, r) => s + r.kw, 0);
  const centralKw = rackList.filter((r) => r.type.role === "central").reduce((s, r) => s + r.kw, 0);
  const d = cooling.design;
  const dtcKw = computeKw * d.dtcFraction;
  const computeAirKw = computeKw - dtcKw;
  const rdhxLoadKw = computeAirKw + centralKw;
  const rdhxCapacityKw = rackList.reduce((s, r) => s + r.type.rdhxKw, 0);
  const coolerPods = pods.pods.filter((p) => roofById.get(p.roof.profile)?.type === "dry-cooler");
  const roofCount = coolerPods.length;
  const dc = pods.roofProfiles.find((p) => p.type === "dry-cooler");
  const fansPerRoof = dc ? dc.fanRows * dc.fanCols : 0;
  const airflowRoofM3h = fansPerRoof * d.fanAirflowM3h;
  const airflowRoofM3s = airflowRoofM3h / 3600;
  const airHeatRoofKw = airflowRoofM3s * d.airDensity * d.airCp * d.airDeltaT;
  const coilFaceM2 = dc?.coil ? (dc.coil.banks * dc.coil.length * dc.coil.slant) / 1e6 : 0;
  const coilVelocity = coilFaceM2 ? airflowRoofM3s / coilFaceM2 : 0;
  const airflowNeededM3h = (d.roofMinKw / (d.airDensity * d.airCp * d.airDeltaT)) * 3600;
  const liquidLps = d.roofMinKw / (d.fluidCp * d.fluidDeltaT);
  const thermal = {
    computeKw,
    centralKw,
    totalKw: computeKw + centralKw,
    dtcKw,
    computeAirKw,
    rdhxLoadKw,
    rdhxCapacityKw,
    roofCount,
    roofReqKw: roofCount * d.roofMinKw,
    roofMarginKw: roofCount * d.roofMinKw - dtcKw,
    fansPerRoof,
    airflowRoofM3h,
    airflowRoofM3s,
    airHeatRoofKw,
    coilFaceM2,
    coilVelocity,
    airflowNeededM3h,
    airflowPerFanM3h: fansPerRoof ? airflowNeededM3h / fansPerRoof : 0,
    liquidLps,
    liquidPairLps: liquidLps * roofCount,
    fanKwRoof: fansPerRoof * d.fanMaxKw,
  };

  /* ---------- Geometry ---------- */
  const wall = ch.wallCore + ch.wallFrame;
  const clearL = ch.length - 2 * wall;
  const clearW = ch.width - 2 * wall;
  const n = rackList.length;
  const sec = racks.section;
  const node = partsById.get("gpu-node-4u")?.dims;
  const cdu = partsById.get("cdu-4u-chx200")?.dims;
  const rearNode = bay.depth - (node?.d ?? 0) - bay.frontOffset;
  const rearCdu = bay.depth - (cdu?.d ?? 0) - bay.frontOffset;
  const geometry = {
    wall,
    clearL,
    clearW,
    bayRow: n * bay.pitch,
    bayLength: 2 * bay.endClearance + n * bay.pitch,
    bayStack: bay.frontZone + bay.depth + bay.rdhxDepth + bay.rearReturn,
    usableRack: bay.units * bay.unitHeight,
    tapRail: n * sec.tap.l + (n - 1) * sec.tap.gap + sec.feed.gap + sec.feed.l,
    roofLen: dc ? dc.fanCols * dc.frame + (dc.fanCols - 1) * dc.gap + 2 * dc.endMargin : 0,
    roofWid: dc ? dc.fanRows * dc.frame + (dc.fanRows - 1) * dc.centerGap + 2 * dc.sideMargin : 0,
    rowLength: pods.pods.length * ch.length + (pods.pods.length - 1) * site.row.joint,
    bodyLength: pods.pods.length * ch.length,
    transportHeight: ch.transitHeight + ch.transport.dunnage + ch.transport.trailerDeck,
    deployedHeight: ch.transitHeight + (dc?.height ?? 0),
    rearNode,
    rearCdu,
    aheadNode: rearNode - bay.rearPduClear,
    aheadCdu: rearCdu - bay.rearPduClear,
  };

  /* ---------- Clearances (G-108) ---------- */
  const ceil = ch.flatCeiling;
  const topOf = (h: { od: number; z: number[] }) => Math.max(...h.z) + h.od / 2;
  const botOf = (h: { od: number; z: number[] }) => Math.min(...h.z) - h.od / 2;
  const clearances: Clearance[] = [
    { label: "A-bus upper corner to roof", value: ceil - sec.busA.z[1], text: "" },
    { label: "Upper C-pipe box to flat ceiling", value: ceil - topOf(sec.cHeader), text: "" },
    { label: "Upper W-pipe box to flat ceiling", value: ceil - topOf(sec.wHeader), text: "" },
    { label: "End-feed corner to roof", value: ceil - sec.feed.z[1], text: "" },
    { label: "Upper fiber tray to ceiling", value: ceil - Math.max(...sec.fiber.trays.map((t) => t[1])), text: "" },
    {
      label: "Tap withdrawal to rack top",
      value: sec.tap.withdrawal - bay.height,
      text: `${fmt(sec.tap.withdrawal)} - ${fmt(bay.height)} = `,
    },
    { label: "Lower W pipe to leak tray", value: botOf(sec.wHeader) - sec.leakTray.z[1], text: "" },
  ].map((c) => ({
    ...c,
    text:
      c.label === "Lower W pipe to leak tray"
        ? `${fmt(c.value)} mm insulation-to-tray gap`
        : c.text
          ? `${c.text}${fmt(c.value)} mm`
          : `${fmt(c.value)} mm vertical gap`,
  }));

  /* ---------- Pods on site ---------- */
  const podPositions: PodPosition[] = [];
  let cursor = 0;
  for (const id of site.row.order) {
    const pod = pods.pods.find((p) => p.id === id);
    if (!pod) continue;
    podPositions.push({ pod, x: cursor, roof: roofById.get(pod.roof.profile) });
    cursor += ch.length + site.row.joint;
  }

  /* ---------- Shell cost ---------- */
  const shellTotals: Record<string, number> = {};
  for (const line of pods.shellCost)
    for (const [k, v] of Object.entries(line.cost)) shellTotals[k] = (shellTotals[k] ?? 0) + v;

  /* ---------- Checks ---------- */
  // Referential integrity
  for (const b of bom.items)
    if (!partsById.has(b.partId))
      add({
        id: `ref-bom-${b.id}`,
        group: "Data",
        label: `BOM ${b.id} part exists`,
        value: b.partId,
        status: "fail",
        ref: `bom:${b.id}`,
      });
  for (const t of racks.types)
    for (const p of [
      t.frame,
      t.rdhx,
      ...t.slots.map((s) => s.part),
      ...t.zeroU.map((z) => z.part),
      ...t.kits.map((k) => k.part),
    ])
      if (p && !partsById.has(p))
        add({
          id: `ref-rack-${t.id}-${p}`,
          group: "Data",
          label: `Rack type ${t.id} part exists`,
          value: p,
          status: "fail",
        });
  add({
    id: "bom-unique",
    group: "BOM",
    label: "Unique BOM IDs",
    value: `${ids.size} unique / ${bom.items.length} rows`,
    status: ids.size === bom.items.length ? "pass" : "fail",
  });

  // BOM qty vs model
  for (const b of bom.items) {
    const count = placed.get(b.partId);
    if (count == null) continue;
    add({
      id: `qty-${b.id}`,
      group: "BOM vs model",
      label: `${b.id} qty matches placed`,
      value: `BOM ${b.qty} / placed ${count}`,
      status: b.qty === count ? "pass" : "fail",
      ref: `bom:${b.id}`,
    });
  }
  const busway = bomById.get("E5");
  const tapRating = partsById.get(busway?.partId ?? "")?.ratings.taps;
  if (typeof tapRating === "number")
    add({
      id: "taps",
      group: "BOM vs model",
      label: "E5 busway taps match racks x 2",
      value: `E5 ${tapRating} / placed ${placed.get("busway-tap") ?? 0}`,
      status: tapRating === placed.get("busway-tap") ? "pass" : "fail",
      ref: "bom:E5",
    });

  // Shell cost
  for (const pod of pods.pods) {
    const line = lines.find((l) => l.id === pod.shellBom);
    const sum = shellTotals[pod.id] ?? 0;
    add({
      id: `shell-${pod.id}`,
      group: "BOM",
      label: `${pod.shellBom} equals ${pod.short.toLowerCase()} shell breakdown`,
      value: `${fmt(line?.unitCost)} vs ${fmt(sum)}`,
      status: line?.unitCost === sum ? "pass" : "fail",
      ref: `bom:${pod.shellBom}`,
    });
  }

  // Rack U audit
  for (const a of uAudit) {
    const ok = a.overlaps.length === 0 && a.outOfRange.length === 0;
    add({
      id: `u-${a.typeId}`,
      group: "Racks",
      label: `${a.typeId} U fit / no overlaps`,
      value: `${a.assigned} of ${bay.units}U assigned`,
      status: ok ? (a.free.length ? "warn" : "pass") : "fail",
      detail: [...a.overlaps, ...a.outOfRange, a.free.length ? `Unassigned: U${a.free.join(", U")}` : ""]
        .filter(Boolean)
        .join("; "),
    });
  }
  add({
    id: "u-height",
    group: "Racks",
    label: "Usable U pitch fits bay height",
    value: `${fmtN(geometry.usableRack, 1)} <= ${fmt(bay.height)} mm`,
    status: geometry.usableRack <= bay.height ? "pass" : "fail",
  });
  add({
    id: "bay-length",
    group: "Geometry",
    label: "Rack row fits clear length",
    value: `${bay.endClearance} + ${n} x ${bay.pitch} + ${bay.endClearance} = ${fmt(geometry.bayLength)} / ${fmt(clearL)}`,
    status: geometry.bayLength <= clearL ? "pass" : "fail",
  });
  add({
    id: "bay-depth",
    group: "Geometry",
    label: "Bay depth stack fits clear width",
    value: `${bay.frontZone} + ${fmt(bay.depth)} + ${bay.rdhxDepth} + ${bay.rearReturn} = ${fmt(geometry.bayStack)} / ${fmt(clearW)}`,
    status: geometry.bayStack <= clearW ? "pass" : "fail",
  });
  add({
    id: "tap-rail",
    group: "Geometry",
    label: "Busway tap packing fits clear length",
    value: `${fmt(geometry.tapRail)} <= ${fmt(clearL)} mm`,
    status: geometry.tapRail <= clearL ? "pass" : "fail",
    ref: "bom:E5",
  });
  add({
    id: "roof-len",
    group: "Geometry",
    label: "Roof fan frames pack pod length",
    value: `${fmt(geometry.roofLen)} / ${fmt(ch.length)} mm`,
    status: geometry.roofLen === ch.length ? "pass" : geometry.roofLen < ch.length ? "warn" : "fail",
    ref: "bom:M3A",
  });
  add({
    id: "roof-wid",
    group: "Geometry",
    label: "Roof fan frames pack pod width",
    value: `${fmt(geometry.roofWid)} / ${fmt(ch.width)} mm`,
    status: geometry.roofWid === ch.width ? "pass" : geometry.roofWid < ch.width ? "warn" : "fail",
    ref: "bom:M3A",
  });
  add({
    id: "row-length",
    group: "Geometry",
    label: "Three-pod row meets target block",
    value: `${fmt(geometry.rowLength)} / ${fmt(site.row.targetLength)} mm`,
    status: geometry.rowLength <= site.row.targetLength ? "pass" : "fail",
  });
  add({
    id: "rear-depth",
    group: "Geometry",
    label: "Rear connection depth ahead of PDU zones",
    value: `${fmtN(geometry.aheadNode, 1)} node / ${fmtN(geometry.aheadCdu, 1)} CDU mm`,
    status: geometry.aheadNode > 0 && geometry.aheadCdu > 0 ? "warn" : "fail",
    detail: "Plugs and hose bends unverified.",
  });
  add({
    id: "transport",
    group: "Geometry",
    label: "Loaded transport height",
    value: `${fmt(ch.transitHeight)} + ${ch.transport.dunnage} + ${ch.transport.trailerDeck} = ${fmt(geometry.transportHeight)} mm`,
    status: "info",
    detail: "Custom pod / not ISO certified.",
  });
  for (const c of clearances)
    add({
      id: `clr-${c.label}`,
      group: "Clearances",
      label: c.label,
      value: `${fmt(c.value)} mm`,
      status: c.value > 0 ? "pass" : "fail",
    });

  // Power
  for (const [typeId, rp] of byType) {
    const bank = rp.banks[0];
    add({
      id: `bank-${typeId}`,
      group: "Power",
      label: `${typeId} bank capacity >= rack cap`,
      value: `${fmtN(bank.kW, 1)} kW vs ${rp.rack.kw} kW`,
      status: bank.kW >= rp.rack.kw ? "pass" : "fail",
    });
    add({
      id: `tap-${typeId}`,
      group: "Power",
      label: `${typeId} tap rating >= bank breakers`,
      value: `${rp.tapAmps} A vs ${rp.breakerSum} A`,
      status: rp.tapAmps >= rp.breakerSum ? "pass" : "fail",
    });
  }
  const bus = electrical.busways[0];
  const busKw = ((Math.sqrt(sys.phases) * sys.vLL * bus.amps * sys.continuousFactor) / 1000) * sys.pf;
  const busLoadKw = thermal.totalKw / electrical.busways.length;
  add({
    id: "bus-normal",
    group: "Power",
    label: "Busway load, normal A/B share",
    value: `${fmt(busLoadKw)} kW vs ${fmt(busKw)} kW`,
    status: busLoadKw <= busKw ? "pass" : "fail",
    ref: "bom:E5",
  });
  add({
    id: "bus-failover",
    group: "Power",
    label: "Full-load A/B failover on one busway",
    value: `${fmt(thermal.totalKw)} kW vs ${fmt(busKw)} kW`,
    status: thermal.totalKw <= busKw ? "pass" : "warn",
    detail: "Full-load upstream A/B rail failover is NOT provided.",
    ref: "bom:E5",
  });
  const tx = partsById.get(bomById.get("E1")?.partId ?? "")?.ratings.kVA;
  if (typeof tx === "number")
    add({
      id: "tx",
      group: "Power",
      label: "Transformer >= IT kVA",
      value: `${fmt(tx)} kVA vs ${fmt(thermal.totalKw / sys.pf)} kVA`,
      status: tx >= thermal.totalKw / sys.pf ? "pass" : "fail",
      ref: "bom:E1",
    });

  // Thermal
  add({
    id: "roof-req",
    group: "Cooling",
    label: "Roof requirement covers DTC load",
    value: `${roofCount} x ${d.roofMinKw} = ${fmt(thermal.roofReqKw)} kW vs ${fmt(dtcKw)} kW`,
    status: thermal.roofReqKw >= dtcKw ? "pass" : "fail",
    detail: "Procurement requirement, not achieved performance.",
  });
  add({
    id: "chiller",
    group: "Cooling",
    label: "Chiller covers hot-day full IT load",
    value: `${fmt(d.chillerNetKw)} kW vs ${fmt(thermal.totalKw)} kW`,
    status: d.chillerNetKw >= thermal.totalKw ? "pass" : "fail",
    ref: "bom:M5",
  });
  add({
    id: "rdhx",
    group: "Cooling",
    label: "Rear-door capacity covers air heat",
    value: `${fmt(rdhxCapacityKw)} kW vs ${fmt(rdhxLoadKw)} kW`,
    status: rdhxCapacityKw >= rdhxLoadKw ? "pass" : "fail",
    ref: "bom:R4",
  });
  add({
    id: "air-screen",
    group: "Cooling",
    label: "Air-side heat screen per roof",
    value: `${fmtN(airHeatRoofKw, 1)} kW vs ${d.roofMinKw} kW`,
    status: airHeatRoofKw >= d.roofMinKw ? "pass" : "fail",
    detail: "Rated coil duty is still required.",
  });
  add({
    id: "liquid",
    group: "Cooling",
    label: "Roof liquid flow within reserve",
    value: `${fmtN(thermal.liquidPairLps, 1)} vs ${d.roofReserveFlowLps} L/s`,
    status: thermal.liquidPairLps <= d.roofReserveFlowLps ? "pass" : "fail",
  });
  const fanFeeder = thermal.fanKwRoof <= d.roofFeederKw;
  add({
    id: "fan-feeder",
    group: "Cooling",
    label: "Roof fan load within feeder",
    value: `${fmtN(thermal.fanKwRoof, 2)} kW vs ${d.roofFeederKw} kW`,
    status: fanFeeder ? "pass" : "fail",
  });

  /* ---------- Template vars ---------- */
  const cduCount = rackList.reduce((s, r) => s + r.type.slots.filter((x) => x.kind === "cdu").length, 0);
  const nodeCount = rackList.reduce((s, r) => s + r.type.slots.filter((x) => x.kind === "node").length, 0);
  const auxPos = (role: string) => {
    const t = racks.types.find((x) => x.role === role);
    const s = t?.slots.find((x) => x.kind === "aux");
    return s ? `U${s.uStart}` : "-";
  };
  const fan = partsById.get(dc?.fanPart ?? "");
  const vars: Vars = {
    rackCount: n,
    cduCount,
    nodeCount,
    pduCount: vertical + horizontal,
    dtcKw: fmt(dtcKw),
    rdhxKw: fmt(rdhxLoadKw),
    totalKw: fmt(thermal.totalKw),
    chillerMw: (d.chillerNetKw / 1000).toFixed(2),
    ambientC: d.designAmbientC,
    upsKw: d.upsKw,
    upsMin: d.upsMinutes,
    upsTarget: d.upsTargetKw,
    auxPositions: `Compute: ${auxPos("compute")} / central IT: ${auxPos("central")}`,
    pitch: bay.pitch,
    rdhxCompute: racks.types.find((t) => t.role === "compute")?.rdhxKw ?? "-",
    rdhxCentral: racks.types.find((t) => t.role === "central")?.rdhxKw ?? "-",
    "node.w": fmtN(node?.w),
    "node.d": fmtN(node?.d),
    "node.h": fmtN(node?.h),
    "cdu.w": fmtN(cdu?.w),
    "cdu.d": fmt(cdu?.d),
    u4: fmtN(4 * bay.unitHeight, 1),
    rearNode: fmtN(rearNode, 1),
    rearCdu: fmtN(rearCdu, 1),
    aheadNode: fmtN(geometry.aheadNode, 1),
    aheadCdu: fmtN(geometry.aheadCdu, 1),
    "pdu0.w": fmtN(partsById.get("cpi-e0-1192")?.dims?.w),
    "pdu0.d": fmtN(partsById.get("cpi-e0-1192")?.dims?.d),
    "zone.w": bay.zeroUZone.w,
    "zone.d": bay.zeroUZone.d,
    fanDia: fan?.ratings.fanDia ?? "-",
  };

  return {
    partsById,
    bomById,
    bomByPart,
    rackTypes,
    racks: rackList,
    bom: { lines, areaTotals, total, uniqueIds: ids.size },
    uAudit,
    power: {
      racks: rackPower,
      byType,
      pdus: { vertical, horizontal, total: vertical + horizontal, byPart: pduByPart },
      taps: rackList.length * 2,
      busKw,
      busLoadKw,
    },
    thermal,
    geometry,
    clearances,
    pods: podPositions,
    placed,
    shellTotals,
    checks,
    vars,
  };
}

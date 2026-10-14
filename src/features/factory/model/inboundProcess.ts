import { MATERIALS, podBill, type Scenario, type Spread } from "./catalog";
import { HANDLING, SLOT_HOURS, SUPPLIERS, TRUCK_MINUTES, type InboundConfig, type TruckKind } from "./inbound";

/*
 * Receiving as it would run on the real dock: each step's place, crew,
 * equipment, timing, rules and failure modes, the build-out it needs, and a
 * week's load against what's on hand. The simulation runs the same steps
 * with the same figures; this is the written form for the team building it.
 */

export interface ProcessStep {
  id: string;
  title: string;
  where: string;
  who: string;
  equipment: string;
  time: string;
  does: string[];
  rules: string[];
  exceptions: string[];
  records: string[];
}

const mins = ([a, b, c]: Spread) => `${a}–${c} min, typically ${b}`;
const clock = (h: number) => `${String(h).padStart(2, "0")}:00`;
const label = (material: string) => MATERIALS.find((m) => m.id === material)?.label.toLowerCase() ?? material;

export function inboundSteps(cfg: InboundConfig): ProcessStep[] {
  const hours = `${clock(cfg.opens)}–${clock(cfg.closes)}`;
  return [
    {
      id: "order",
      title: "Purchase order, appointment and ASN",
      where: "Planning, in the ERP",
      who: "Materials planner",
      equipment: "ERP and the supplier portal",
      time: "Weekly, each supplier on its own day",
      does: [
        "On the supplier's order day, order each material up to its cover, less what's on hand and on order.",
        "Round every line up to whole handling units: full crates, bundles and pallets only.",
        "The supplier packs the order into truckloads and ships bigger orders as daily drops.",
        `It books one dock appointment per truck: vans on the hour, flatbeds every ${SLOT_HOURS.flatbed} hours, ${clock(cfg.opens)} to ${clock(cfg.closes - 2)}, one truck per door per slot.`,
        "At least 24 hours out, it sends the advance ship notice (ASN): HU list, serials, seal number, carrier and trailer.",
      ],
      rules: [
        "No ASN, no appointment: a truck without one is worked in only if a door is free.",
        "Appointments go to the first free slot at or after the lead time; nobody double-books a door.",
      ],
      exceptions: [
        "A supplier misses its ship date: rebook the next free slot and flag the material's cover.",
        "An ASN doesn't match the PO: hold the appointment until purchasing clears it.",
      ],
      records: ["PO lines and HU counts", "Appointment per truck", "ASN against the PO"],
    },
    {
      id: "gate",
      title: "Gate check-in",
      where: "Guard shack at the truck gate",
      who: "Gate guard, around the clock",
      equipment: "Yard management system, seal cutter, camera",
      time: mins(TRUCK_MINUTES.gate),
      does: [
        "Match the truck to its appointment and ASN; check the driver's ID and the BOL.",
        "Check the seal is intact and its number matches the ASN; photograph it.",
        "Walk the trailer for damage, leaks and load shift visible from outside.",
        `Send the truck to a free door if the dock is open and one is free, otherwise to one of the ${cfg.yardStalls} yard stalls; when they're full, it holds at the gate.`,
      ],
      rules: [
        "Trucks are worked in appointment order, not arrival order; early trucks wait.",
        `The carrier's ${cfg.freeHours} free hours start at the appointment, or at arrival if the truck is late.`,
      ],
      exceptions: [
        "Broken or mismatched seal: hold the truck, call the receiving lead, open only with the driver present.",
        "No appointment: work it in if a door is free, otherwise it waits or is turned away.",
      ],
      records: ["Gate-in time", "Seal number and photo", "Stall or door assigned"],
    },
    {
      id: "dock",
      title: "Yard, door and docking",
      where: `${cfg.vanDoors} dock-high doors for vans, ${cfg.flatbedBays} drive-in flatbed bay${cfg.flatbedBays === 1 ? "" : "s"}`,
      who: "Driver, under the dock lead",
      equipment: "Vehicle restraint, hydraulic leveler, dock seal and light; the bay's bridge crane",
      time: `Docking ${mins(TRUCK_MINUTES.dock)}; a flatbed's tarps and straps ${mins(TRUCK_MINUTES.untarp)} more`,
      does: [
        `While the dock is open (${hours}), give each free door the waiting truck of its kind with the earliest appointment.`,
        "Vans back onto the door; the restraint locks the trailer's rear bar; the leveler goes down; the seal inflates.",
        "Flatbeds drive into the bay; the driver takes off the tarps and straps before the first lift.",
        "Check the trailer floor and the load before any forklift goes in.",
      ],
      rules: [
        "No forklift enters a trailer until the restraint shows green.",
        "Nobody stands under a load; the bay is closed to foot traffic during lifts.",
      ],
      exceptions: [
        "Load shifted or fallen in transit: photograph it before touching anything and treat the HUs as suspect.",
        "Trailer floor damaged: no forklift; unload by pallet jack or refuse the load.",
      ],
      records: ["Door and dock time", "Trailer condition"],
    },
    {
      id: "unload",
      title: "Unloading to staging",
      where: `Dock staging (${cfg.dockStaging} marked spots) and the bay's laydown (${cfg.bayLaydown} spots)`,
      who: `Material handlers: ${cfg.handlers} on the floor; a crane lift takes ${cfg.craneCrew}, an operator and a rigger`,
      equipment: `${cfg.forklifts} forklifts with fork extensions; the bay's crane with a spreader bar and tag lines`,
      time: "Per HU: " + HANDLING.map((h) => `${label(h.material)} ${h.unload[1]} min`).join(", "),
      does: [
        "One HU at a time comes off each truck, straight to a free staging spot, in the order it was loaded.",
        "Vans unload by forklift; flatbeds by the bay's crane onto the laydown.",
        "Each HU's spot is scanned so the floor always knows what's where.",
      ],
      rules: [
        "Racks are tall and heavy: forks spread to the crate's skid, walking pace, never tilted more than 5°.",
        "Steel lifts use the spreader bar at its marked points, tag lines on both ends.",
        `Staging is the limit: with no free spot, unloading stops. Past ${Math.round(cfg.highWater * 100)}% full, handlers put away before they unload.`,
        "Trucks already on a door at close are finished out on overtime.",
      ],
      exceptions: ["Damage found while unloading: set the HU down, tag it, photograph it and tell the clerk."],
      records: ["HU off the truck, by staging spot"],
    },
    {
      id: "check",
      title: "Dock check and BOL",
      where: "Staging, beside the door",
      who: `Receiving clerks: ${cfg.clerks} on the floor`,
      equipment: "Handheld scanner, camera",
      time: `Per HU: ${HANDLING.map((h) => `${label(h.material)} ${h.check[1]} min`).join(", ")}; BOL ${mins(TRUCK_MINUTES.bol)}`,
      does: [
        "Count HUs against the BOL and ASN: over, short and damaged (OS&D).",
        "Look at every HU: packaging, crate and wrap; the shock and tilt indicators on racks; dents and coating damage on steel.",
        "Once the truck is empty and every HU checked, note any exceptions on the BOL, sign it and release the driver.",
      ],
      rules: [
        "Emptied trucks are signed off before anything else, so doors and drivers aren't kept waiting.",
        "Every exception is on the BOL before it's signed; once signed, a carrier claim is much harder.",
      ],
      exceptions: [
        "Damaged: red-tag the HU for MRB, file the carrier claim and reorder the units as an expedite at once.",
        "Short: note it on the BOL and backorder it. Over: hold the extra until purchasing decides.",
      ],
      records: ["OS&D per HU, with photos", "Signed BOL", "Driver release time"],
    },
    {
      id: "receipt",
      title: "Receipt posting",
      where: "Staging",
      who: "Receiving clerk",
      equipment: "Handheld scanner, label printer, ERP",
      time: "Per HU: " + HANDLING.map((h) => `${label(h.material)} ${h.receipt[1]} min`).join(", "),
      does: [
        "Scan each HU's ASN label and capture its serials: every rack and its tray manifest.",
        "Print and apply a license plate (LPN) label, so the HU can be traced to its pod.",
        "Post the receipt against the PO; it's later matched with the invoice.",
        "Flag the HU for incoming inspection if its material's plan pulls it.",
      ],
      rules: ["No HU leaves staging without an LPN and a posted receipt."],
      exceptions: ["A serial isn't on the ASN: hold the HU and ask the supplier before posting."],
      records: ["Receipt per HU", "Serials by LPN"],
    },
    {
      id: "qc",
      title: "Incoming inspection",
      where: "In staging, or at the QC bench",
      who: `QC inspectors: ${cfg.inspectors} on the floor`,
      equipment: "Insulation tester (megger), pressure-decay rig, laser measure, coating thickness gauge, camera",
      time: "Per HU: " + HANDLING.map((h) => `${label(h.material)} ${h.inspect.minutes[1]} min`).join(", "),
      does: HANDLING.map(
        (h) =>
          `${label(h.material)}: ${h.inspect.share === 1 ? "every HU" : `${Math.round(h.inspect.share * 100)}% of HUs`}. ${h.inspect.test}.`,
      ),
      rules: [
        "Racks are not powered on here; that's commissioning at S9. This is the crate, the indicators and the paperwork.",
        "HUs wait in QC hold, in their staging spot, until passed.",
      ],
      exceptions: [
        "Fails: red-tag for the material review board (MRB), open a supplier corrective action (SCAR) and expedite a replacement at half the lead time.",
      ],
      records: ["Inspection result per HU, with readings", "MRB tag and SCAR"],
    },
    {
      id: "putaway",
      title: "Put-away",
      where: "Secure cage (racks), racking (busways, headers, trays, panels), steel lane (frames, roofs, posts, rails)",
      who: "Material handler",
      equipment: "Forklift, or the bay's crane for frames and roofs",
      time: "Per HU: " + HANDLING.map((h) => `${label(h.material)} ${h.putaway[1]} min`).join(", "),
      does: [
        "Take the HU from staging to its zone and scan it into its location.",
        "Red-tagged HUs go to the MRB cage instead, out of stock.",
        "The units are in stock, and kitting can pick them, at the location scan.",
      ],
      rules: [
        "Racks go into the badge-controlled cage the same shift they're passed.",
        "Put-away only in dock hours; it's never done on overtime.",
      ],
      exceptions: ["Location full: put it in the overflow lane and raise it with the store lead."],
      records: ["Location per LPN", "Dock-to-stock time per HU"],
    },
  ];
}

export interface BuildOutGroup {
  title: string;
  items: { item: string; spec: string }[];
}

export function receivingBuildOut(cfg: InboundConfig): BuildOutGroup[] {
  const shifts = (cfg.closes - cfg.opens) / 8;
  return [
    {
      title: "Site",
      items: [
        {
          item: "Truck apron",
          spec: "40 m deep in front of the doors, for a 53 ft trailer and tractor to swing and back on",
        },
        {
          item: "Yard",
          spec: `${cfg.yardStalls} trailer stalls, 4 m by 23 m, with a turning loop back to the gate`,
        },
        {
          item: "Gate",
          spec: "Guard shack with a camera on the lane, staffed around the clock",
        },
      ],
    },
    {
      title: "Dock",
      items: [
        {
          item: "Dock-high doors",
          spec: `${cfg.vanDoors} × 2.7 m by 3.0 m, 1.2 m dock height, 4.5 m centres`,
        },
        {
          item: "Levelers",
          spec: "Hydraulic, 18 t rated: a crated rack on a loaded forklift is over 5 t",
        },
        {
          item: "At each door",
          spec: "Vehicle restraint with red and green lights, inflatable seal, LED dock light",
        },
      ],
    },
    {
      title: "Flatbed bay",
      items: [
        {
          item: "Drive-in bay",
          spec: `${cfg.flatbedBays} × 5 m by 5 m door, 36 m of bay: the rig drives in, unloads and drives out`,
        },
        {
          item: "Crane",
          spec: "10 t bridge crane per bay, pendant controlled, with a 7 m spreader bar and tag lines",
        },
        {
          item: "Laydown",
          spec: `${cfg.bayLaydown} spots of 7.6 m by 3.6 m for frames, roofs and spool crates`,
        },
      ],
    },
    {
      title: "Receiving floor",
      items: [
        {
          item: "Staging",
          spec: `${cfg.dockStaging} marked floor spots, each with a scannable location label`,
        },
        {
          item: "QC bench",
          spec: "Megger, pressure-decay rig, laser measure, coating gauge, camera stand",
        },
        {
          item: "MRB cage",
          spec: "Locked, about 20 m², for red-tagged HUs awaiting a decision",
        },
        {
          item: "Secure cage",
          spec: "Badge access and cameras for racks, counted every week",
        },
      ],
    },
    {
      title: "Equipment and systems",
      items: [
        {
          item: "Forklifts",
          spec: `${cfg.forklifts} × 5,000 lb with 2.4 m fork extensions and side-shift, plus a charging station`,
        },
        {
          item: "Scanners and printers",
          spec: "A handheld per clerk and handler, a label printer at staging",
        },
        {
          item: "Systems",
          spec: "Dock scheduling, yard management and the ERP, sharing one ASN and LPN record",
        },
      ],
    },
    {
      title: "Crew per shift",
      items: [
        {
          item: "Shifts",
          spec: `${shifts === Math.round(shifts) ? shifts : shifts.toFixed(1)} of 8 h, ${clock(cfg.opens)} to ${clock(cfg.closes)}`,
        },
        {
          item: "On the floor",
          spec: `${cfg.handlers} material handlers, ${cfg.clerks} receiving clerk${cfg.clerks === 1 ? "" : "s"}, ${cfg.inspectors} QC inspector${cfg.inspectors === 1 ? "" : "s"}, and a dock lead`,
        },
        {
          item: "Gate",
          spec: "One guard at a time, around the clock: about 4.2 people",
        },
      ],
    },
  ];
}

const mean = ([a, b, c]: Spread) => (a + b + c) / 3;

export interface LoadRow {
  id: string;
  label: string;
  /** Hours of work a week, and hours on hand while the dock is open. */
  need: number;
  have: number;
}

export interface DockLoad {
  podsPerWeek: number;
  trucks: Record<TruckKind, number>;
  hus: number;
  rows: LoadRow[];
}

/** A week's receiving at the release rate, averaged: what it asks of each resource. */
export function dockLoad(sc: Scenario): DockLoad {
  const cfg = sc.inbound;
  const podsPerWeek = 168 / sc.releaseEveryHours;
  const cycles = 168 / sc.reviewHours;
  const bill = podBill(sc.stations);
  const trucks: Record<TruckKind, number> = { van: 0, flatbed: 0 };
  let hus = 0;
  const need = {
    doorsvan: 0,
    doorsflatbed: 0,
    handlers: 0,
    forklifts: 0,
    cranes: 0,
    clerks: 0,
    inspectors: 0,
  };
  SUPPLIERS.forEach((s) => {
    let share = 0;
    HANDLING.forEach((h) => {
      if (h.supplier !== s.id) return;
      const m = MATERIALS.findIndex((x) => x.id === h.material);
      const count = (bill[m] * podsPerWeek) / h.perHu;
      hus += count;
      share += count / cycles / h.perTruck;
      const unload = (count * mean(h.unload)) / 60;
      const put = (count * mean(h.putaway)) / 60;
      need[s.truck === "van" ? "doorsvan" : "doorsflatbed"] += unload;
      if (s.truck === "van") {
        need.handlers += unload;
        need.forklifts += unload;
      } else {
        need.handlers += unload * cfg.craneCrew;
        need.cranes += unload;
      }
      if (h.putawayWith === "crane") {
        need.handlers += put * cfg.craneCrew;
        need.cranes += put;
      } else {
        need.handlers += put;
        need.forklifts += put;
      }
      need.clerks += (count * (mean(h.check) + mean(h.receipt))) / 60;
      need.inspectors += (count * h.inspect.share * mean(h.inspect.minutes)) / 60;
    });
    const n = Math.ceil(share - 1e-9) * cycles;
    trucks[s.truck] += n;
    const perTruck = (mean(TRUCK_MINUTES.dock) + mean(TRUCK_MINUTES.bol) + mean(TRUCK_MINUTES.pullOut)) / 60;
    need[s.truck === "van" ? "doorsvan" : "doorsflatbed"] +=
      n * (perTruck + (s.truck === "flatbed" ? mean(TRUCK_MINUTES.untarp) / 60 : 0));
    need.clerks += (n * mean(TRUCK_MINUTES.bol)) / 60;
  });
  const week = (cfg.closes - cfg.opens) * 7;
  return {
    podsPerWeek,
    trucks,
    hus,
    rows: [
      {
        id: "doorsvan",
        label: "Van doors",
        need: need.doorsvan,
        have: cfg.vanDoors * week,
      },
      {
        id: "doorsflatbed",
        label: "Flatbed bays",
        need: need.doorsflatbed,
        have: cfg.flatbedBays * week,
      },
      {
        id: "handlers",
        label: "Material handlers",
        need: need.handlers,
        have: cfg.handlers * week,
      },
      {
        id: "forklifts",
        label: "Forklifts",
        need: need.forklifts,
        have: cfg.forklifts * week,
      },
      {
        id: "cranes",
        label: "Bay cranes",
        need: need.cranes,
        have: cfg.flatbedBays * week,
      },
      {
        id: "clerks",
        label: "Receiving clerks",
        need: need.clerks,
        have: cfg.clerks * week,
      },
      {
        id: "inspectors",
        label: "QC inspectors",
        need: need.inspectors,
        have: cfg.inspectors * week,
      },
    ],
  };
}

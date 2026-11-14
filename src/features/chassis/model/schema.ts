import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const Dims = z.object({
  w: z.number().nullable(),
  d: z.number().nullable(),
  h: z.number().nullable(),
});
export type Dims = z.infer<typeof Dims>;

const Rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const Point = z.tuple([z.number(), z.number()]);

/* ------------------------------------------------------------------ */
/* project.json                                                        */
/* ------------------------------------------------------------------ */

export const Project = z.object({
  name: z.string(),
  subtitle: z.string(),
  status: z.string(),
  revision: z.number(),
  date: z.string(),
  classification: z.string(),
  podSummary: z.string(),
  capacity: z.string(),
  units: z.string(),
  paper: z.string(),
});
export type Project = z.infer<typeof Project>;

/* ------------------------------------------------------------------ */
/* sheets.json                                                         */
/* ------------------------------------------------------------------ */

export const SheetNote = z.object({ title: z.string(), body: z.string() });

export const Sheet = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  discipline: z.enum(["G", "E", "M"]),
  scale: z.string(),
  renderer: z.string(),
  notes: z.array(SheetNote).default([]),
});
export type Sheet = z.infer<typeof Sheet>;

export const SheetsFile = z.object({ sheets: z.array(Sheet) });

/* ------------------------------------------------------------------ */
/* parts.json - catalog                                                */
/* ------------------------------------------------------------------ */

export const PartCategory = z.enum(["shell", "rack", "power", "cooling", "controls", "outdoor", "it", "service"]);
export type PartCategory = z.infer<typeof PartCategory>;

export const CostBasis = z.enum(["A", "P", "U"]);
export type CostBasis = z.infer<typeof CostBasis>;

export const Part = z.object({
  partId: z.string(),
  name: z.string(),
  category: PartCategory,
  manufacturer: z.string().nullable().default(null),
  sku: z.string().nullable().default(null),
  productUrl: z.string().nullable().default(null),
  dims: Dims.nullable().default(null),
  rackUnits: z.number().nullable().default(null),
  ratings: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  unitCost: z.number().nullable().default(null),
  costBasis: CostBasis.nullable().default(null),
  /** bom = priced BOM line, tenant = tenant-supplied IT (excluded from cost), component = covered by another BOM line */
  supply: z.enum(["bom", "tenant", "component"]).default("bom"),
  coveredBy: z.string().nullable().default(null),
  notes: z.string().default(""),
});
export type Part = z.infer<typeof Part>;

export const PartsFile = z.object({ parts: z.array(Part) });

/* ------------------------------------------------------------------ */
/* bom.json                                                            */
/* ------------------------------------------------------------------ */

export const BomArea = z.enum(["compute", "cooling", "electrical", "outdoor"]);
export type BomArea = z.infer<typeof BomArea>;

export const BomItem = z.object({
  id: z.string(),
  area: BomArea,
  group: z.string(),
  partId: z.string(),
  qty: z.number(),
  scope: z.string(),
  unitCostOverride: z.number().nullable().default(null),
});
export type BomItem = z.infer<typeof BomItem>;

export const BomFile = z.object({
  areas: z.array(z.object({ id: BomArea, label: z.string() })),
  items: z.array(BomItem),
  basisNote: z.string(),
  totalNote: z.string(),
});

/* ------------------------------------------------------------------ */
/* pods.json                                                           */
/* ------------------------------------------------------------------ */

export const Placement = z.object({
  id: z.string(),
  bom: z.string().nullable().default(null),
  part: z.string().nullable().default(null),
  shape: z.enum(["rect", "circle"]).default("rect"),
  x: z.number(),
  y: z.number(),
  /** Plan width (along pod length). Falls back to part dims.w. */
  w: z.number().nullable().default(null),
  /** Plan depth (across pod width). Falls back to part dims.d. */
  d: z.number().nullable().default(null),
  style: z.enum(["solid", "dashed", "light", "dark"]).default("solid"),
  label: z.array(z.string()).default([]),
  siteLabel: z.string().nullable().default(null),
});
export type Placement = z.infer<typeof Placement>;

export const RoofProfile = z.object({
  id: z.string(),
  type: z.enum(["dry-cooler", "insulated"]),
  height: z.number(),
  fanPart: z.string().nullable().default(null),
  fanRows: z.number().default(0),
  fanCols: z.number().default(0),
  frame: z.number().default(0),
  gap: z.number().default(0),
  endMargin: z.number().default(0),
  centerGap: z.number().default(0),
  sideMargin: z.number().default(0),
  boltCenters: z.number().default(0),
  nozzleDia: z.number().default(0),
  coil: z
    .object({
      length: z.number(),
      slant: z.number(),
      thick: z.number(),
      banks: z.number(),
      endZone: z.number(),
      headerReserve: z.number(),
    })
    .nullable()
    .default(null),
  stack: z
    .object({
      coilHigh: z.number(),
      fanLow: z.number(),
      coilBottom: z.number(),
      deckTop: z.number(),
      fanFlange: z.number(),
      guardTop: z.number(),
      drainSkin: z.tuple([z.number(), z.number()]),
      fanAxialDepth: z.number(),
      fanAxialReserve: z.number(),
    })
    .nullable()
    .default(null),
  kits: z.array(z.object({ part: z.string(), qty: z.number() })).default([]),
});
export type RoofProfile = z.infer<typeof RoofProfile>;

export const Pod = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  shellBom: z.string(),
  roof: z.object({ profile: z.string(), tag: z.string(), label: z.string(), sub: z.string() }),
  servicePanelsPerFace: z.number().default(0),
  partitions: z.array(z.object({ x: z.number(), w: z.number() })).default([]),
  placements: z.array(Placement).default([]),
  annotations: z
    .array(z.object({ x: z.number(), y: z.number(), text: z.string(), bold: z.boolean().default(false) }))
    .default([]),
  exteriorNote: z.string().default(""),
});
export type Pod = z.infer<typeof Pod>;

export const ShellCostLine = z.object({
  n: z.string(),
  label: z.string(),
  cost: z.record(z.string(), z.number()),
});

export const PodsFile = z.object({
  chassis: z.object({
    length: z.number(),
    width: z.number(),
    wallCore: z.number(),
    wallFrame: z.number(),
    floorBuildUp: z.number(),
    transitHeight: z.number(),
    deployedHeight: z.number(),
    flatCeiling: z.number(),
    transport: z.object({ dunnage: z.number(), trailerDeck: z.number() }),
    nominal: z.string(),
  }),
  roofProfiles: z.array(RoofProfile),
  pods: z.array(Pod),
  shellCost: z.array(ShellCostLine),
});
export type PodsFile = z.infer<typeof PodsFile>;

/* ------------------------------------------------------------------ */
/* racks.json                                                          */
/* ------------------------------------------------------------------ */

export const SlotKind = z.enum(["node", "cdu", "pdu", "aux", "spare", "network", "storage", "patch", "oob", "mgmt"]);
export type SlotKind = z.infer<typeof SlotKind>;

export const Slot = z.object({
  uStart: z.number(),
  uHeight: z.number(),
  kind: SlotKind,
  part: z.string().nullable().default(null),
  label: z.string(),
  bank: z.enum(["A", "B"]).nullable().default(null),
});
export type Slot = z.infer<typeof Slot>;

export const RackType = z.object({
  id: z.string(),
  label: z.string(),
  role: z.enum(["compute", "central"]),
  kwCap: z.number(),
  frame: z.string(),
  rdhx: z.string(),
  rdhxKw: z.number(),
  tapAmps: z.number(),
  slots: z.array(Slot),
  zeroU: z.array(z.object({ id: z.string(), part: z.string(), bank: z.enum(["A", "B"]) })),
  kits: z.array(z.object({ part: z.string(), qty: z.number() })).default([]),
});
export type RackType = z.infer<typeof RackType>;

export const Rack = z.object({
  id: z.string(),
  type: z.string(),
  tap: z.string(),
});
export type Rack = z.infer<typeof Rack>;

export const RacksFile = z.object({
  bay: z.object({
    pitch: z.number(),
    depth: z.number(),
    height: z.number(),
    units: z.number(),
    unitHeight: z.number(),
    endClearance: z.number(),
    frontZone: z.number(),
    rdhxDepth: z.number(),
    rearReturn: z.number(),
    equipmentFace: z.number(),
    /** Front rail offset: bay depth minus body depth minus this = gross rear connection depth. */
    frontOffset: z.number(),
    /** Rail / post frame on each side of the bay. */
    sideFrame: z.number(),
    /** Rear depth consumed by the 0U PDU corner zones and their clearance. */
    rearPduClear: z.number(),
    zeroUZone: z.object({ w: z.number(), d: z.number(), h: z.number() }),
    auxReserve: z.object({ w: z.number(), d: z.number(), h: z.number() }),
    manifoldBody: z.number(),
  }),
  types: z.array(RackType),
  racks: z.array(Rack),
  section: z.object({
    busA: z.object({ y: z.number(), z: z.tuple([z.number(), z.number()]), w: z.number() }),
    busB: z.object({ y: z.number(), z: z.tuple([z.number(), z.number()]), w: z.number() }),
    tap: z.object({
      l: z.number(),
      w: z.number(),
      h: z.number(),
      z: z.tuple([z.number(), z.number()]),
      withdrawal: z.number(),
      gap: z.number(),
    }),
    feed: z.object({
      l: z.number(),
      w: z.number(),
      h: z.number(),
      z: z.tuple([z.number(), z.number()]),
      gap: z.number(),
    }),
    fiber: z.object({ y: z.tuple([z.number(), z.number()]), trays: z.array(z.tuple([z.number(), z.number()])) }),
    wHeader: z.object({ y: z.number(), od: z.number(), z: z.array(z.number()) }),
    cHeader: z.object({ y: z.number(), od: z.number(), z: z.array(z.number()) }),
    leakTray: z.object({ y: z.tuple([z.number(), z.number()]), z: z.tuple([z.number(), z.number()]) }),
  }),
});
export type RacksFile = z.infer<typeof RacksFile>;

/* ------------------------------------------------------------------ */
/* electrical.json                                                     */
/* ------------------------------------------------------------------ */

export const SldNode = z.object({
  id: z.string(),
  bom: z.string().nullable().default(null),
  label: z.string(),
  lines: z.array(z.string()).default([]),
});
export type SldNode = z.infer<typeof SldNode>;

export const ElectricalFile = z.object({
  system: z.object({
    label: z.string(),
    vLL: z.number(),
    phases: z.number(),
    pf: z.number(),
    continuousFactor: z.number(),
    note: z.string(),
  }),
  switchboard: SldNode.extend({ amps: z.number() }),
  mains: z.array(SldNode.extend({ busway: z.string(), frameAmps: z.number() })),
  busways: z.array(SldNode.extend({ amps: z.number(), spd: z.string() })),
  feeders: z.array(SldNode),
  originSpd: SldNode,
  coolingChain: z.array(SldNode.extend({ kind: z.enum(["breaker", "box"]).default("box") })),
  computeBoxLabel: z.string(),
  checksNote: z.string(),
});
export type ElectricalFile = z.infer<typeof ElectricalFile>;

/* ------------------------------------------------------------------ */
/* cooling.json                                                        */
/* ------------------------------------------------------------------ */

export const CoolingComponent = z.object({
  id: z.string(),
  loop: z.enum(["W", "C", "both"]),
  kind: z.enum(["pumpPair", "box", "hx", "valve", "roofBranches"]),
  bom: z.string().nullable().default(null),
  part: z.string().nullable().default(null),
  qty: z.number().default(0),
  label: z.string(),
  lines: z.array(z.string()).default([]),
  pos: Rect,
  style: z.enum(["solid", "light", "dark"]).default("solid"),
});
export type CoolingComponent = z.infer<typeof CoolingComponent>;

export const CoolingEdge = z.object({
  from: z.string(),
  to: z.string(),
  loop: z.enum(["W", "C"]),
  kind: z.enum(["flow", "heat", "bypass"]),
  label: z.string().nullable().default(null),
  labelAt: Point.nullable().default(null),
  points: z.array(Point),
});
export type CoolingEdge = z.infer<typeof CoolingEdge>;

export const CoolingFile = z.object({
  design: z.object({
    dtcFraction: z.number(),
    roofMinKw: z.number(),
    roofFluid: z.string(),
    fluidCp: z.number(),
    fluidDeltaT: z.number(),
    airDensity: z.number(),
    airCp: z.number(),
    airDeltaT: z.number(),
    fanAirflowM3h: z.number(),
    fanMaxKw: z.number(),
    roofFeederKw: z.number(),
    roofReserveFlowLps: z.number(),
    chillerNetKw: z.number(),
    designAmbientC: z.number(),
    upsKw: z.number(),
    upsTargetKw: z.number(),
    upsMinutes: z.number(),
  }),
  loops: z.array(z.object({ id: z.enum(["W", "C"]), title: z.string(), at: Point })),
  components: z.array(CoolingComponent),
  edges: z.array(CoolingEdge),
  texts: z.array(
    z.object({ at: Point, text: z.string(), bold: z.boolean().default(false), size: z.number().default(1.6) }),
  ),
});
export type CoolingFile = z.infer<typeof CoolingFile>;

/* ------------------------------------------------------------------ */
/* site.json                                                           */
/* ------------------------------------------------------------------ */

export const SiteFile = z.object({
  row: z.object({ order: z.array(z.string()), joint: z.number(), targetLength: z.number(), targetLabel: z.string() }),
  equipment: z.array(
    z.object({
      id: z.string(),
      bom: z.string().nullable().default(null),
      x: z.number(),
      y: z.number(),
      l: z.number(),
      w: z.number(),
      h: z.number(),
      label: z.string(),
      lines: z.array(z.string()).default([]),
      note: z.string().default(""),
      fans: z.number().default(0),
    }),
  ),
  links: z.array(
    z.object({
      id: z.string(),
      bom: z.string().nullable().default(null),
      side: z.enum(["front", "rear"]),
      style: z.enum(["solid", "dashdot", "dashed"]),
      label: z.string(),
    }),
  ),
});
export type SiteFile = z.infer<typeof SiteFile>;

/* ------------------------------------------------------------------ */
/* Aggregate                                                           */
/* ------------------------------------------------------------------ */

export const DesignData = z.object({
  project: Project,
  sheets: SheetsFile,
  parts: PartsFile,
  bom: BomFile,
  pods: PodsFile,
  racks: RacksFile,
  electrical: ElectricalFile,
  cooling: CoolingFile,
  site: SiteFile,
});
export type DesignData = z.infer<typeof DesignData>;
export type DataFileName = keyof DesignData;
export const DATA_FILES = Object.keys(DesignData.shape) as DataFileName[];

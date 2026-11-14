import { Box, Callout, FILL, Hit, LW, Para, Txt } from "@/features/chassis/drawing/core";
import { INK } from "@/features/chassis/drawing/palette";
import { fmt, fmtN } from "@/features/chassis/model/format";
import { uRange } from "@/features/chassis/model/calc";
import type { Ref } from "@/features/chassis/model/refs";
import { COLORS } from "@/features/chassis/three/colors";
import { useSheetData } from "./useSheetData";

export const INTERIOR_RECT = { x: 84, y: 41, w: 254, h: 226 };
export const EXTERIOR_RECT = { x: 10, y: 46, w: 400, h: 206 };

const WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];
const word = (n: number) => WORDS[n] ?? String(n);

function ViewportFrame({ rect }: { rect: typeof INTERIOR_RECT }) {
  return (
    <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={FILL.light} stroke={INK} strokeWidth={LW.thin} />
  );
}

function Note({
  x,
  y,
  n,
  title,
  body,
  refs,
}: {
  x: number;
  y: number;
  n: number;
  title: string;
  body: string;
  refs: Ref;
}) {
  return (
    <Hit {...refs}>
      <rect x={x - 2} y={y - 4} width={68} height={17} fill="transparent" />
      <Callout x={x + 2.5} y={y} n={n} r={2.4} />
      <Txt x={x + 7} y={y} size={1.45} bold>
        {title}
      </Txt>
      <Para x={x + 7} y={y + 5} w={58} size={1.2} text={body} />
    </Hit>
  );
}

export function ComputeInteriorSheet() {
  const { data, d } = useSheetData();
  const n = d.racks.length;
  const central = d.racks.filter((r) => r.type.role === "central");
  const computeType = data.racks.types.find((t) => t.role === "compute");
  const cduSlot = computeType?.slots.find((s) => s.kind === "cdu");
  const cduCount = Number(d.vars.cduCount);
  const trays = data.racks.section.fiber.trays.length;

  const legend: { label: string; color: string }[] = [
    { label: "COMPUTE", color: COLORS.node },
    { label: "NETWORK / STORAGE", color: COLORS.network },
    { label: "ELECTRICAL / PDUs", color: COLORS.pdu },
    { label: "COOLING / CDUs / RDHx", color: COLORS.cdu },
  ];
  const left = [
    { n: 1, title: "NETWORK TRAYS", body: `${word(trays)} overhead fiber trays`, refs: { bom: "B3" } },
    { n: 2, title: "COOLING HEADERS", body: "Rear supply and return pipes", refs: { bom: "B8" } },
    { n: 3, title: "BUSWAYS + TAPS", body: `A/B power and ${d.power.taps} rack taps`, refs: { bom: "E5" } },
    {
      n: 4,
      title: "IT PDUs + AUX",
      body: `${d.power.pdus.total} IT PDUs; ${n} cooling AUX panels`,
      refs: { bom: "R3" },
    },
  ];
  const right = [
    { n: 5, title: "REAR-DOOR EXCHANGERS", body: `One per rack; ${n} total`, refs: { bom: "R4" } },
    {
      n: 6,
      title: "NETWORK + STORAGE",
      body: `${central.map((r) => r.id).join(" / ")} in the ${central.length === 2 ? "two" : central.length} middle bays`,
      refs: { rack: central[0]?.id },
    },
    {
      n: 7,
      title: "RACK CDUs",
      body: `${word(cduCount)} ${cduSlot?.uHeight ?? 4}U CDUs at ${cduSlot ? uRange(cduSlot) : "-"}`,
      refs: { bom: "R2" },
    },
  ];

  return (
    <g>
      {legend.map((l, i) => (
        <g key={l.label}>
          <rect x={13 + i * 100} y={32.5} width={7} height={3.5} fill={l.color} stroke={INK} strokeWidth={LW.thin} />
          <Txt x={22.5 + i * 100} y={34.3} size={1.4} bold>
            {l.label}
          </Txt>
        </g>
      ))}
      <ViewportFrame rect={INTERIOR_RECT} />
      {left.map((note, i) => (
        <Note key={note.n} x={13} y={56 + i * 34} {...note} />
      ))}
      {right.map((note, i) => (
        <Note key={note.n} x={343} y={84 + i * 34} {...note} />
      ))}
      <Txt x={343} y={250} size={1.05}>
        Drag to orbit, scroll to zoom,
      </Txt>
      <Txt x={343} y={253.5} size={1.05}>
        click any part to inspect.
      </Txt>
    </g>
  );
}

export function ExteriorSheet() {
  const { data, d } = useSheetData();
  const ch = data.pods.chassis;
  const coolers = d.pods.filter((p) => p.roof?.type === "dry-cooler").length;
  const insulated = d.pods.filter((p) => p.roof && p.roof.type !== "dry-cooler").length;
  const ft = (mm: number) => fmtN(mm / 304.8, 2);
  const front = data.site.links.filter((l) => l.side === "front");
  const rear = data.site.links.filter((l) => l.side === "rear");

  return (
    <g>
      <Txt x={13} y={34} size={1.7} bold>
        {`${word(coolers).toUpperCase()} DRY-COOLER ROOF${coolers === 1 ? "" : "S"} + ${word(insulated).toUpperCase()} INSULATED SERVICE ROOF${insulated === 1 ? "" : "S"}`}
      </Txt>
      <Txt x={406} y={34} size={1.3} anchor="end" bold>
        {`${fmt(data.site.row.targetLength)} L x ${fmt(ch.width)} BODY W x ${fmt(d.geometry.deployedHeight)} H mm / services project beyond width`}
      </Txt>
      <Txt x={13} y={40.5} size={1.15}>
        {[...front, ...rear]
          .map((l) => `${l.side.toUpperCase()}: ${l.label.replace(/^[A-Z0-9]+: /, "")}`)
          .join("   |   ")}
      </Txt>
      <ViewportFrame rect={EXTERIOR_RECT} />
      <Box x={10} y={255} w={400} h={9} fill="white" sw={LW.thin} />
      <Txt x={210} y={259.5} size={1.35} anchor="middle" bold>
        {`${data.site.row.joint} mm erection joints / target row ${fmt(data.site.row.targetLength)} mm = ${ft(data.site.row.targetLength)} ft / body-only length ${fmt(d.geometry.bodyLength)} mm = ${ft(d.geometry.bodyLength)} ft`}
      </Txt>
    </g>
  );
}

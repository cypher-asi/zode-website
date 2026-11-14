import {
  Box,
  DASH,
  Dim,
  HatchRect,
  Hit,
  Line,
  LW,
  Para,
  SectionTitle,
  TextBlock,
  Txt,
  View,
} from "@/features/chassis/drawing/core";
import { PodShell } from "@/features/chassis/drawing/podPlan";
import { Table, type Row } from "@/features/chassis/drawing/Table";
import { fmt, usd } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";
import { FILL, INK } from "@/features/chassis/drawing/palette";

const SCALE = 1 / 20;

export function StructuralChassis() {
  const { data, d } = useSheetData();
  const ch = data.pods.chassis;
  const bay = data.racks.bay;
  const pod = data.pods.pods.find((p) => p.id === "compute")!;
  const { wall, clearL, clearW } = d.geometry;
  const L = ch.length;
  const W = ch.width;
  const n = d.racks.length;

  // Shell cost table columns in PDF order (compute / electrical / cooling).
  const podOrder = Object.keys(data.pods.shellCost[0]?.cost ?? {});
  const podsById = new Map(data.pods.pods.map((p) => [p.id, p]));
  const roof = d.bom.lines.find((l) => l.partId === "compute-roof");
  const shellTotal = podOrder.reduce((s, id) => s + (d.shellTotals[id] ?? 0), 0);
  const rows: Row[] = [
    {
      cells: [
        "",
        "03  BASE SHELL COST / USD",
        ...podOrder.map((id) => ({ text: podsById.get(id)?.short ?? id, align: "end" as const })),
      ],
      bold: true,
      fill: "light",
      h: 5,
    },
    ...data.pods.shellCost.map((line) => ({
      cells: [{ text: line.n, bold: true }, line.label, ...podOrder.map((id) => usd(line.cost[id] ?? 0))],
    })),
    {
      cells: [
        "",
        `${podOrder.map((id) => podsById.get(id)?.shellBom).join(" / ")} - EACH ONCE IN BOM`,
        ...podOrder.map((id) => usd(d.bom.lines.find((l) => l.id === podsById.get(id)?.shellBom)?.unitCost)),
      ],
      bold: true,
      fill: "light",
      h: 5,
    },
  ];

  return (
    <g>
      <SectionTitle x={13} y={33}>
        01 COMPUTE CHASSIS / ROOF REMOVED
      </SectionTitle>
      <Txt x={406} y={33} size={1.25} anchor="end" bold>
        1:20 AT A3 / SAME SCALE AS ALL THREE POD PLANS
      </Txt>

      <View x={59} y={52} scale={SCALE}>
        <Dim
          x1={0}
          y1={0}
          x2={L}
          y2={0}
          offset={-8}
          text={`${fmt(L)} overall / nominal ${ch.nominal} custom compute chassis`}
        />
        <Txt x={L / 2} y={-3.6 / SCALE} size={1.2} anchor="middle" bold>
          {`${pod.servicePanelsPerFace} REMOVABLE INSULATED SERVICE PANELS PER FACE / EQUIPMENT OMITTED`}
        </Txt>
        <Dim x1={0} y1={0} x2={0} y2={W} offset={-6} text={`${fmt(W)} overall`} />
        <Dim x1={L} y1={wall} x2={L} y2={W - wall} offset={8} textSide="below" text={`${fmt(clearW)} clear`} />

        <PodShell pod={pod} wall={wall} length={L} width={W} panels={pod.servicePanelsPerFace}>
          {/* rack load-path axes */}
          {Array.from({ length: n + 1 }, (_, i) => (
            <Line
              key={i}
              x1={bay.endClearance + i * bay.pitch}
              y1={0}
              x2={bay.endClearance + i * bay.pitch}
              y2={clearW}
              sw={LW.hair}
              dash={DASH.dashed}
            />
          ))}
          {[bay.frontZone, bay.frontZone + bay.depth].map((y) => (
            <Line key={y} x1={0} y1={y} x2={clearL} y2={y} sw={LW.hair} dash={DASH.dashed} />
          ))}
          <Box x={clearL / 2 - 1950} y={clearW / 2 - 450} w={3900} h={900} fill="white" sw={LW.med} />
          <TextBlock
            x={clearL / 2}
            y={clearW / 2}
            lines={[
              `${fmt(clearL)} x ${fmt(clearW)} mm CLEAR INSIDE WALL ZONES`,
              `Base frame / floor build-up: ${ch.floorBuildUp} mm total`,
              "Dashed axes indicate rack load paths; steel sizes and bracing require structural design.",
            ]}
            size={1.25}
            firstSize={1.9}
            gap={2}
          />
          <Dim
            x1={0}
            y1={clearW + wall}
            x2={clearL}
            y2={clearW + wall}
            offset={4}
            textSide="below"
            text={`${fmt(clearL)} clear = ${bay.endClearance} end + ${n} x ${bay.pitch} custom panel / rack bays + ${bay.endClearance} end`}
          />
        </PodShell>

        {/* scale bar */}
        <g transform={`translate(${-wall * 2} ${W + 250})`}>
          {[0, 1000].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={0}
              width={1000}
              height={50}
              fill={i % 2 ? FILL.white : INK}
              stroke={INK}
              strokeWidth={LW.hair / SCALE}
            />
          ))}
          {[0, 1, 2].map((m) => (
            <Txt key={m} x={m * 1000} y={150} size={1} anchor="middle">
              {m === 2 ? "2 m" : String(m)}
            </Txt>
          ))}
        </g>
      </View>

      <Txt x={406} y={185} size={1.25} anchor="end" bold>
        {`${wall} wall / frame each side = ${ch.wallCore} core + ${ch.wallFrame} frame / thermal-break allowance`}
      </Txt>

      {/* 02 wall thickness at 1:2 */}
      <SectionTitle x={13} y={192}>
        02 WALL THICKNESS / 1:2 AT A3
      </SectionTitle>
      <View x={19} y={212} scale={1 / 2}>
        <Dim x1={0} y1={0} x2={wall} y2={0} offset={-5} text={`${wall} mm total wall-frame zone`} size={1.4} />
        <Txt x={0} y={-4} size={1.0} bold>
          OUTSIDE
        </Txt>
        <Txt x={wall} y={-4} size={1.0} anchor="end" bold>
          INSIDE
        </Txt>
        <Hit bom={pod.shellBom}>
          <HatchRect x={0} y={0} w={ch.wallCore} h={46} spacing={2} />
          <Box x={ch.wallCore} y={0} w={ch.wallFrame} h={46} fill="dark" sw={LW.med} />
        </Hit>
        <Dim
          x1={0}
          y1={46}
          x2={ch.wallCore}
          y2={46}
          offset={4}
          textSide="below"
          text={`${ch.wallCore} core`}
          size={1.4}
        />
        <Dim
          x1={ch.wallCore}
          y1={46}
          x2={wall}
          y2={46}
          offset={4}
          textSide="below"
          text={`${ch.wallFrame} zone`}
          size={1.4}
        />
      </View>
      <Para
        x={100}
        y={209}
        w={58}
        size={1.2}
        text={`${ch.wallCore} mm insulation core. Core outside primary frame, within the ${fmt(L)} overall length. ${ch.wallFrame} mm frame / thermal-break zone. Final skins, joints and steel sizes require release.`}
      />

      {/* 03 base shell cost */}
      <Table
        x={168}
        y={193}
        cols={[{ w: 8 }, { w: 95 }, { w: 45, align: "end" }, { w: 45, align: "end" }, { w: 45, align: "end" }]}
        rows={rows}
        rowH={3.55}
        size={1.12}
      />
      <Hit bom={roof?.id}>
        <Box
          x={168}
          y={193 + 5 + data.pods.shellCost.length * 3.55 + 5 + 1.5}
          w={238}
          h={6.5}
          fill="white"
          sw={LW.thick}
        />
      </Hit>
      <Txt x={170} y={193 + 10 + data.pods.shellCost.length * 3.55 + 4.75} size={1.3} bold>
        {`THREE BASE SHELLS / COMPUTE ROOF +${usd(roof?.total)}`}
      </Txt>
      <Txt x={404} y={193 + 10 + data.pods.shellCost.length * 3.55 + 4.75} size={2.4} anchor="end" bold>
        {usd(shellTotal)}
      </Txt>
    </g>
  );
}

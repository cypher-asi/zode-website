import {
  Box,
  DASH,
  Dim,
  Hit,
  Legend,
  LINE_STYLES,
  Line,
  LW,
  TextBlock,
  Txt,
  View,
} from "@/features/chassis/drawing/core";
import { PodShell } from "@/features/chassis/drawing/podPlan";
import { fmt, pad2 } from "@/features/chassis/model/format";
import { rackPlanLines } from "@/features/chassis/model/rackText";
import { useSheetData } from "./useSheetData";

const SCALE = 1 / 20;

export function ComputePod() {
  const { data, d } = useSheetData();
  const pod = data.pods.pods.find((p) => p.id === "compute")!;
  const ch = data.pods.chassis;
  const bay = data.racks.bay;
  const sec = data.racks.section;
  const { wall, clearL, clearW } = d.geometry;
  const L = ch.length;
  const W = ch.width;
  const rowX0 = d.racks[0]?.x ?? 0;
  const rowX1 = rowX0 + d.racks.length * bay.pitch;
  const rackY = bay.frontZone;
  const rdhxY = rackY + bay.depth;
  const auxY = rackY + bay.depth - bay.zeroUZone.d - 40;

  const runs = [
    { label: "A", y: sec.busA.y, style: LINE_STYLES.busway, bom: "E5" },
    { label: "B", y: sec.busB.y, style: LINE_STYLES.busway, bom: "E5" },
    { label: "FIBER", y: (sec.fiber.y[0] + sec.fiber.y[1]) / 2, style: LINE_STYLES.fiber, bom: "B3" },
    { label: "DTC", y: sec.wHeader.y, style: LINE_STYLES.dtc, bom: "B8" },
    { label: "CHW", y: sec.cHeader.y - 60, style: LINE_STYLES.rdhx, bom: "M7" },
  ];

  return (
    <g>
      <Legend
        x={20}
        y={36}
        items={Object.values(LINE_STYLES).map((s) => ({ label: s.label, dash: s.dash, sw: s.sw }))}
      />

      <View x={59} y={96} scale={SCALE}>
        <Dim x1={0} y1={0} x2={L} y2={0} offset={-16} text={`${fmt(L)} overall / ${fmt(clearL)} clear inside`} />
        <Txt x={L / 2} y={-6 / SCALE} size={1.25} anchor="middle" bold>
          {pod.exteriorNote}
        </Txt>
        <Dim x1={0} y1={0} x2={0} y2={W} offset={-10} text={`${fmt(W)} overall`} />

        <PodShell pod={pod} wall={wall} length={L} width={W} panels={pod.servicePanelsPerFace}>
          {/* Service runs (drawn first so racks sit on top) */}
          {runs.map((r) => (
            <Hit key={r.label} bom={r.bom}>
              <Line x1={0} y1={r.y} x2={clearL} y2={r.y} sw={r.style.sw} dash={r.style.dash} />
              <rect x={0} y={r.y - 40} width={clearL} height={80} fill="transparent" />
              <Txt x={-wall - 60} y={r.y} size={1.1} anchor="end" bold>
                {r.label}
              </Txt>
            </Hit>
          ))}

          {d.racks.map((r, i) => {
            const lines = rackPlanLines(r.type, d);
            const central = r.type.role === "central";
            return (
              <g key={r.id}>
                {/* busway taps, staggered A / B */}
                <Hit part="busway-tap" title={`${r.tap}A / ${r.tap}B tap`}>
                  <Box x={r.x + bay.pitch - 170} y={sec.busA.y - 55} w={140} h={110} fill="white" sw={LW.thin} />
                  <Box x={r.x + 60} y={sec.busB.y - 55} w={140} h={110} fill="white" sw={LW.thin} />
                </Hit>

                <Hit rack={r.id} title={`${r.id} - ${r.type.label}`}>
                  <Box x={r.x} y={rackY} w={bay.pitch} h={bay.depth} fill={central ? "light" : "white"} sw={LW.med} />
                  <Box x={r.x + 30} y={rackY + 40} w={bay.pitch - 60} h={bay.depth - 80} fill="none" sw={LW.hair} />
                  <TextBlock x={r.x + bay.pitch / 2} y={rackY + 230} lines={[r.id]} size={2} />
                  <TextBlock
                    x={r.x + bay.pitch / 2}
                    y={rackY + 420}
                    lines={lines.slice(0, 2)}
                    size={1.0}
                    firstBold={central}
                  />
                  <TextBlock
                    x={r.x + bay.pitch / 2}
                    y={rackY + 980}
                    lines={lines.slice(3)}
                    size={0.95}
                    firstBold={false}
                  />
                </Hit>

                {/* rear-corner 0U PDUs */}
                {r.type.zeroU.map((z, zi) => (
                  <Hit key={z.id} part={z.part} title={`${r.id} ${z.id} 0U PDU`}>
                    <Box
                      x={zi === 0 ? r.x + 15 : r.x + bay.pitch - 15 - bay.zeroUZone.w}
                      y={auxY}
                      w={bay.zeroUZone.w}
                      h={bay.zeroUZone.w * 1.2}
                      fill="mid"
                      sw={LW.thin}
                    />
                  </Hit>
                ))}

                {/* rear-door heat exchanger */}
                <Hit part={r.type.rdhx} title={`RDHx ${pad2(i + 1)}`}>
                  <Box x={r.x} y={rdhxY} w={bay.pitch} h={bay.rdhxDepth} fill="white" sw={LW.thin} />
                  {Array.from({ length: 11 }, (_, f) => (
                    <Line
                      key={f}
                      x1={r.x + 40 + f * 47}
                      y1={rdhxY + 40}
                      x2={r.x + 40 + f * 47}
                      y2={rdhxY + bay.rdhxDepth - 130}
                      sw={LW.hair}
                    />
                  ))}
                  <Txt x={r.x + bay.pitch / 2} y={rdhxY + bay.rdhxDepth - 65} size={1.0} anchor="middle" bold>
                    {`RDHx ${pad2(i + 1)}`}
                  </Txt>
                </Hit>
              </g>
            );
          })}

          <Line
            x1={0}
            y1={rdhxY + bay.rdhxDepth}
            x2={clearL}
            y2={rdhxY + bay.rdhxDepth}
            sw={LW.hair}
            dash={DASH.fine}
          />
          <Txt x={clearL + wall + 80} y={rdhxY - 80} size={1.1} bold>
            E13 AUX
          </Txt>
          <Dim
            x1={rowX0}
            y1={clearW}
            x2={rowX1}
            y2={clearW}
            offset={10}
            textSide="below"
            text={`${fmt(rowX1 - rowX0)} rack row / ${d.racks.length} x ${bay.pitch} mm bays`}
          />
        </PodShell>
      </View>
    </g>
  );
}

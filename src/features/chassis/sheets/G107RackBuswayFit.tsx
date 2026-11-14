import {
  Box,
  Circle,
  DASH,
  Dim,
  HatchRect,
  Hit,
  Line,
  LW,
  Para,
  Poly,
  SectionTitle,
  TextBlock,
  Txt,
  View,
} from "@/features/chassis/drawing/core";
import { fmt, fmtN, tpl } from "@/features/chassis/model/format";
import { railLayout } from "@/features/chassis/model/layout";
import { useSheetData } from "./useSheetData";
import { INK } from "@/features/chassis/drawing/palette";

/** Plan-view band rows for the A and B tap rails (not to true across-pod position). */
const ROW_Y = [150, 650];

export function RackBuswayFit() {
  const { data, d } = useSheetData();
  const bay = data.racks.bay;
  const sec = data.racks.section;
  const ch = data.pods.chassis;
  const sheet = data.sheets.sheets.find((s) => s.id === "G-107");
  const type = data.racks.types.find((t) => t.role === "compute") ?? data.racks.types[0];
  const node = d.partsById.get("gpu-node-4u")?.dims;
  const cdu = d.partsById.get("cdu-4u-chx200")?.dims;
  const pdu0 = d.partsById.get(type.zeroU[0]?.part ?? "");
  const { wall, clearL, tapRail, rearCdu, aheadCdu } = d.geometry;
  const n = d.racks.length;
  const lane = bay.pitch - 2 * bay.sideFrame - 2 * bay.zeroUZone.w;
  const zoneXs = [bay.sideFrame, bay.pitch - bay.sideFrame - bay.zeroUZone.w];
  const nodeX = (bay.pitch - (node?.w ?? 448)) / 2;

  // Note callouts with leader targets (paper mm) into the 1:10 plan.
  const plan = { x: 55, y: 64, k: 0.1 };
  const P = (lx: number, ly: number): [number, number] => [plan.x + lx * plan.k, plan.y + ly * plan.k];
  const targets: [number, number][] = [
    P(bay.pitch - nodeX, 0),
    P(bay.pitch - nodeX, 500),
    P(bay.pitch - nodeX, (bay.frontOffset + (node?.d ?? 0) + bay.depth) / 2),
    P(bay.pitch - bay.sideFrame - bay.zeroUZone.w / 2, bay.depth - bay.zeroUZone.d / 2),
    P(bay.pitch, bay.depth + bay.rdhxDepth / 2),
  ];
  const noteYs = [76, 112, 148, 181, 218];

  const rails = railLayout(data, d);

  return (
    <g>
      <SectionTitle x={13} y={33}>
        01 RACK BAY / PLAN AT 1:10
      </SectionTitle>
      <View x={plan.x} y={plan.y} scale={plan.k}>
        <Dim x1={0} y1={0} x2={bay.pitch} y2={0} offset={-6} text={`${bay.pitch} mm custom bay pitch`} />
        <Dim x1={0} y1={0} x2={0} y2={bay.depth} offset={-14} text={`${fmt(bay.depth)} bay depth`} />
        <Hit part={type.frame}>
          <Box x={0} y={0} w={bay.pitch} h={bay.depth} fill="white" sw={LW.thick} />
          {[0, bay.pitch - 30].flatMap((x) =>
            [0, bay.depth - 30].map((y) => <Box key={`${x}${y}`} x={x} y={y} w={30} h={30} fill="mid" sw={LW.thin} />),
          )}
        </Hit>
        <Hit part="gpu-node-4u">
          <Box x={nodeX} y={bay.frontOffset} w={node?.w ?? 448} h={node?.d ?? 991.4} fill="light" sw={LW.med} />
        </Hit>
        <Hit part="cdu-4u-chx200">
          <Box
            x={nodeX}
            y={bay.frontOffset}
            w={cdu?.w ?? 448}
            h={cdu?.d ?? 1000}
            fill="none"
            dash={DASH.fine}
            sw={LW.thin}
          />
        </Hit>
        {zoneXs.map((zx, i) => (
          <Hit key={zx} part={pdu0?.partId}>
            <Box
              x={zx}
              y={bay.depth - bay.zeroUZone.d}
              w={bay.zeroUZone.w}
              h={bay.zeroUZone.d}
              fill="none"
              dash={DASH.fine}
              sw={LW.thin}
            />
            <Box
              x={zx + (bay.zeroUZone.w - (pdu0?.dims?.w ?? 55)) / 2}
              y={bay.depth - bay.zeroUZone.d / 2 - (pdu0?.dims?.d ?? 71) / 2}
              w={pdu0?.dims?.w ?? 55}
              h={pdu0?.dims?.d ?? 71}
              fill="mid"
              sw={LW.thin}
            />
            <Txt x={zx + bay.zeroUZone.w / 2} y={bay.depth - bay.zeroUZone.d - 35} size={0.9} anchor="middle" bold>
              {type.zeroU[i]?.id ?? ""}
            </Txt>
          </Hit>
        ))}
        <Hit part={type.rdhx}>
          <Box x={0} y={bay.depth} w={bay.pitch} h={bay.rdhxDepth} fill="white" sw={LW.med} />
          {Array.from({ length: 9 }, (_, i) => (
            <Line
              key={i}
              x1={60 + i * 54}
              y1={bay.depth + 30}
              x2={60 + i * 54}
              y2={bay.depth + bay.rdhxDepth - 140}
              sw={LW.hair}
            />
          ))}
          <TextBlock
            x={bay.pitch / 2}
            y={bay.depth + bay.rdhxDepth - 75}
            lines={["CUSTOM RDHx", `${bay.pitch} W x ${bay.rdhxDepth} D RESERVE`]}
            size={0.95}
          />
        </Hit>
        <Box
          x={0}
          y={bay.depth + bay.rdhxDepth}
          w={bay.pitch}
          h={bay.rearReturn}
          fill="none"
          dash={DASH.fine}
          sw={LW.thin}
          label={[`${bay.rearReturn} REAR RETURN`, "NO SERVICE AISLE"]}
          labelSize={0.95}
        />
      </View>

      {sheet?.notes.map((note, i) => {
        const y = noteYs[i] ?? 76 + i * 34;
        const t = targets[i];
        return (
          <g key={note.title}>
            {t && <Poly points={[[124, y], [118, y], t]} sw={LW.hair} />}
            <Txt x={126} y={y} size={1.25} bold>
              {note.title}
            </Txt>
            <Para x={126} y={y + 4.5} w={76} size={1.15} text={tpl(note.body, d.vars)} />
          </g>
        );
      })}

      {/* 02 taps + feeds */}
      <SectionTitle x={213} y={33}>
        02 A/B TAPS + END FEEDS / PLAN AT 1:35
      </SectionTitle>
      <View x={218} y={58} scale={1 / 35}>
        <Dim
          x1={0}
          y1={0}
          x2={ch.length}
          y2={0}
          offset={-9}
          text={`${fmt(ch.length)} overall / ${fmt(clearL)} inside wall zones`}
        />
        <Box x={0} y={0} w={ch.length} h={1100} fill="white" sw={LW.med} />
        <HatchRect x={0} y={0} w={wall} h={1100} spacing={1} />
        <HatchRect x={ch.length - wall} y={0} w={wall} h={1100} spacing={1} />
        {rails.map((rail, ri) => (
          <g key={rail.id}>
            {rail.items.map((it) =>
              it.kind === "feed" ? (
                <Hit key={it.label} part="busway-end-feed">
                  <Box
                    x={wall + it.x}
                    y={ROW_Y[ri]}
                    w={it.l}
                    h={sec.tap.w}
                    fill="mid"
                    sw={LW.thin}
                    label={[it.label]}
                    labelSize={0.85}
                  />
                </Hit>
              ) : (
                <Hit key={it.label} part="busway-tap" title={`${it.label} tap -> ${it.rackId}`}>
                  <Box
                    x={wall + it.x}
                    y={ROW_Y[ri]}
                    w={it.l}
                    h={sec.tap.w}
                    fill="white"
                    sw={LW.thin}
                    label={[it.label]}
                    labelSize={0.85}
                  />
                </Hit>
              ),
            )}
          </g>
        ))}
        {d.racks.map((r) => (
          <Hit key={r.id} rack={r.id}>
            <Txt x={wall + r.x + bay.pitch / 2} y={1350} size={0.95} anchor="middle" bold>
              {r.id}
            </Txt>
          </Hit>
        ))}
      </View>
      <Para
        x={218}
        y={104}
        w={186}
        size={1.15}
        text={`Each rail: ${n} x ${sec.tap.l} mm taps + ${n - 1} x ${sec.tap.gap} mm gaps + ${sec.feed.gap} mm feed gap + ${sec.feed.l} mm feed = ${fmt(tapRail)} mm. This ${tapRail <= clearL ? "fits" : "DOES NOT fit"} the ${fmt(clearL)} mm clear length as a box-packing study. The two tap rows are staggered; labels map to the ten physical bays below.`}
      />
      <Para
        x={218}
        y={116}
        w={186}
        size={1.15}
        text={`Raised roof: bus body Z${fmt(sec.busA.z[0])}-${fmt(sec.busA.z[1])}; taps Z${fmt(sec.tap.z[0])}-${fmt(sec.tap.z[1])}; withdrawal to Z${fmt(sec.tap.withdrawal)}. Feed reserves: ${sec.feed.l} L x ${sec.feed.w} W x ${sec.feed.h} H at Z${fmt(sec.feed.z[0])}-${fmt(sec.feed.z[1])}. OEM slot pitch, joint zones, box-opening clearance and incoming-cable bend envelopes are not yet approved.`}
      />
      <line x1={213} y1={136} x2={406} y2={136} stroke={INK} strokeWidth={LW.thin} />

      {/* 03 rear-corner packaging */}
      <SectionTitle x={213} y={142}>
        03 REAR-CORNER PACKAGING / PLAN AT 1:3
      </SectionTitle>
      <View x={222} y={164} scale={1 / 3}>
        <Dim
          x1={0}
          y1={-20}
          x2={bay.pitch}
          y2={-20}
          offset={-4}
          text={`${bay.pitch} bay / two ${bay.zeroUZone.w} mm edge zones / ${lane} mm central lane`}
        />
        <Box x={0} y={-20} w={bay.pitch} h={rearCdu + 20} fill="none" sw={LW.thin} />
        <Hit part="cdu-4u-chx200">
          <Line x1={0} y1={0} x2={bay.pitch} y2={0} sw={LW.med} dash={DASH.dashed} />
          <Txt x={bay.pitch / 2} y={14} size={1.1} anchor="middle" bold>
            {`CDU REAR BODY PLANE / ${fmt(cdu?.d)} D RESERVE`}
          </Txt>
        </Hit>
        {zoneXs.map((zx, i) => (
          <Hit key={zx} part={pdu0?.partId}>
            <Box
              x={zx}
              y={rearCdu - bay.zeroUZone.d}
              w={bay.zeroUZone.w}
              h={bay.zeroUZone.d}
              fill="light"
              dash={DASH.fine}
              sw={LW.thin}
            />
            <Box
              x={zx + (bay.zeroUZone.w - (pdu0?.dims?.w ?? 55)) / 2}
              y={rearCdu - bay.zeroUZone.d / 2 - (pdu0?.dims?.d ?? 71) / 2}
              w={pdu0?.dims?.w ?? 55}
              h={pdu0?.dims?.d ?? 71}
              fill="mid"
              sw={LW.med}
              label={[type.zeroU[i]?.id ?? ""]}
              labelSize={1.1}
            />
          </Hit>
        ))}
        {[0, bay.pitch - 24].map((x) => (
          <Box key={x} x={x} y={rearCdu - 24} w={24} h={24} fill="mid" sw={LW.thin} />
        ))}
        <Hit part="cdu-manifold-kit">
          {[bay.sideFrame + bay.zeroUZone.w + 50, bay.pitch - bay.sideFrame - bay.zeroUZone.w - 50].map((x) => (
            <g key={x}>
              <Circle cx={x} cy={rearCdu - 70} r={bay.manifoldBody / 2 + 6} fill="light" sw={LW.med} />
              <Txt x={x} y={rearCdu - 70} size={1.0} anchor="middle" bold>
                M
              </Txt>
            </g>
          ))}
        </Hit>
        <TextBlock
          x={bay.pitch / 2}
          y={70}
          lines={[
            `${fmtN(aheadCdu)} mm before rear-corner zones`,
            `${fmtN(rearCdu)} mm gross from CDU body to bay rear`,
            `M = provisional ${bay.manifoldBody} mm manifold body`,
          ]}
          size={1.15}
          firstBold={false}
          gap={1.6}
        />
        <Dim
          x1={zoneXs[0] + bay.zeroUZone.w}
          y1={rearCdu}
          x2={zoneXs[1]}
          y2={rearCdu}
          offset={4}
          textSide="below"
          text={`${lane} clear between PDU zones`}
        />
      </View>
    </g>
  );
}

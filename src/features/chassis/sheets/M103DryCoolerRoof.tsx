import { Box, Circle, Dim, Hit, Line, LW, SectionTitle, Txt, View } from "@/features/chassis/drawing/core";
import { RoofSection } from "@/features/chassis/drawing/roofSection";
import { fmt, fmtN, pad2 } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";
import { FILL, INK } from "@/features/chassis/drawing/palette";

export function DryCoolerRoof() {
  const { data, d } = useSheetData();
  const roof = data.pods.roofProfiles.find((r) => r.type === "dry-cooler");
  const ch = data.pods.chassis;
  if (!roof || !roof.stack || !roof.coil) return null;
  const fan = d.partsById.get(roof.fanPart ?? "");
  const fanDia = Number(fan?.ratings.fanDia ?? 800);
  const L = ch.length;
  const W = ch.width;
  const s = roof.stack;
  const c = roof.coil;
  const g = d.geometry;

  const fanPos = Array.from({ length: roof.fanRows * roof.fanCols }, (_, i) => {
    const r = Math.floor(i / roof.fanCols);
    const col = i % roof.fanCols;
    return {
      n: i + 1,
      x: roof.endMargin + col * (roof.frame + roof.gap),
      y: roof.sideMargin + r * (roof.frame + roof.centerGap),
    };
  });

  const fit: [string, string][] = [
    [
      "Frame packing, length",
      `${roof.fanCols} x ${roof.frame} + ${roof.fanCols - 1} x ${roof.gap} + 2 x ${roof.endMargin} = ${fmt(g.roofLen)}`,
    ],
    [
      "Frame packing, width",
      `${roof.fanRows} x ${roof.frame} + ${roof.centerGap} + 2 x ${roof.sideMargin} = ${fmt(g.roofWid)}`,
    ],
    ["Fan assembly axial depth", `${s.fanAxialDepth} max reference / ${s.fanAxialReserve} reserved`],
    [
      "Fan / guard positions",
      `${fmt(s.fanLow)}-${fmt(s.fanFlange)} / ${fmt(s.fanFlange)}-${fmt(s.guardTop)} above base`,
    ],
    ["Coil envelope, each bank", `${fmt(c.length)} L x ${fmt(c.slant)} slant x ~${c.thick} thick`],
    ["Coil high point / fan low point", `${fmt(s.coilHigh)} / ${fmt(s.fanLow)} = ${s.fanLow - s.coilHigh} gap`],
    ["Coil ends / header zones", `${fmtN((L - c.length) / 2)} each end / ${c.headerReserve} header reserve`],
    ["Coil bottom / drip-deck top", `${s.coilBottom} / ${s.deckTop} = ${s.coilBottom - s.deckTop} gap`],
  ];

  return (
    <g>
      <SectionTitle x={13} y={33}>
        {`01 TWELVE FAN ASSEMBLIES / ${roof.fanRows} x ${roof.fanCols} / PLAN AT 1:20`}
      </SectionTitle>
      <View x={59} y={49} scale={1 / 20}>
        <Dim
          x1={0}
          y1={0}
          x2={L}
          y2={0}
          offset={-8}
          text={`${fmt(L)} = ${roof.fanCols} x ${roof.frame} frames + ${roof.fanCols - 1} x ${roof.gap} gaps + 2 x ${roof.endMargin} end margins`}
        />
        <Dim x1={0} y1={0} x2={0} y2={W} offset={-10} text={`${fmt(W)} base width`} />
        <Dim
          x1={L}
          y1={0}
          x2={L}
          y2={W}
          offset={10}
          textSide="below"
          text={`${fmt(W)} flat top = ${roof.fanRows} x ${roof.frame} + ${roof.centerGap} + 2 x ${roof.sideMargin}`}
        />
        <Hit part="cooler-frame">
          <Box x={0} y={0} w={L} h={W} fill="white" sw={LW.med} />
        </Hit>
        {fanPos.map((f) => {
          const cx = f.x + roof.frame / 2;
          const cy = f.y + roof.frame / 2;
          return (
            <Hit key={f.n} part={roof.fanPart} title={`F${pad2(f.n)}`}>
              <Box x={f.x} y={f.y} w={roof.frame} h={roof.frame} fill="white" sw={LW.med} />
              <Circle cx={cx} cy={cy} r={roof.nozzleDia / 2} fill="light" sw={LW.thin} />
              <Circle cx={cx} cy={cy} r={fanDia / 2} fill="none" sw={LW.hair} />
              {[0, 120, 240].map((a) => (
                <Line
                  key={a}
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(((a - 50) * Math.PI) / 180) * fanDia * 0.45}
                  y2={cy + Math.sin(((a - 50) * Math.PI) / 180) * fanDia * 0.45}
                  sw={LW.hair}
                />
              ))}
              {[
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ].map(([sx, sy]) => (
                <circle
                  key={`${sx}${sy}`}
                  cx={cx + (sx * roof.boltCenters) / 2}
                  cy={cy + (sy * roof.boltCenters) / 2}
                  r={10}
                  fill={INK}
                />
              ))}
              <Box x={cx - 110} y={cy - 55} w={220} h={110} fill="white" sw={LW.thin} />
              <Txt x={cx} y={cy} size={1.0} anchor="middle" bold>
                {`F${pad2(f.n)}`}
              </Txt>
            </Hit>
          );
        })}
      </View>
      <Txt x={210} y={174} size={1.2} anchor="middle" bold>
        {`${roof.frame} square frames / ${roof.boltCenters} bolt centers / ${roof.nozzleDia} nozzle diameter / ${fanDia} nominal fan size / all ${fanPos.length === 12 ? "twelve" : fanPos.length} axes vertical`}
      </Txt>
      <Txt x={210} y={179} size={1.15} anchor="middle">
        {`${fmt(L)} x ${fmt(W)} flat top / vertical exterior sides / height ${fmt(roof.height)} / angled coils remain INSIDE`}
      </Txt>
      <line x1={13} y1={183} x2={406} y2={183} stroke={INK} strokeWidth={LW.thin} />

      <SectionTitle x={76} y={190}>
        02 FAN / COIL / PAN STACK / SECTION 1:25
      </SectionTitle>
      <View x={86} y={196} scale={1 / 25}>
        <RoofSection roof={roof} width={W} />
      </View>
      <Txt x={76} y={264} size={1.0}>
        * S9 independent containment above electrical only; separate from each cooler drip deck.
      </Txt>

      <SectionTitle x={216} y={190}>
        03 FIT CHECK / ALL DIMENSIONS IN mm
      </SectionTitle>
      {fit.map(([title, value], i) => (
        <g key={title}>
          <rect x={216} y={194 + i * 8.2} width={190} height={8.2} fill={FILL.white} stroke={INK} strokeWidth={LW.hair} />
          <Txt x={218} y={194 + i * 8.2 + 2.6} size={1.15} bold>
            {title}
          </Txt>
          <Txt x={218} y={194 + i * 8.2 + 5.9} size={1.15}>
            {value}
          </Txt>
        </g>
      ))}
    </g>
  );
}

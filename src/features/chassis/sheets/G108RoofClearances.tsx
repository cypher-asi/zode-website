import { Dim, SectionTitle, Txt, View } from "@/features/chassis/drawing/core";
import { ComputeSection } from "@/features/chassis/drawing/computeSection";
import { Table, type Row } from "@/features/chassis/drawing/Table";
import { fmt, fmtN } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";

const S = 1 / 20;
const Z_MIN = 2100;

export function RoofClearances() {
  const { data, d } = useSheetData();
  const ch = data.pods.chassis;
  const sec = data.racks.section;
  const H = d.geometry.deployedHeight;
  const roofH = H - ch.transitHeight;
  const range = (z: [number, number]) => `${fmt(z[0])}-${fmt(z[1])}`;

  const envelopes: Row[] = [
    {
      cells: [
        { text: "A/B bus body", bold: true },
        `Y${fmt(sec.busA.y)} / ${fmt(sec.busB.y)}`,
        { text: `Z${range(sec.busA.z)}`, align: "end" },
      ],
      ref: { bom: "E5" },
    },
    {
      cells: [
        { text: "Tap / withdrawal", bold: true },
        `${sec.tap.w} W x ${sec.tap.h} H`,
        { text: `${range(sec.tap.z)} / down to ${fmt(sec.tap.withdrawal)}`, align: "end" },
      ],
      ref: { part: "busway-tap" },
    },
    {
      cells: [
        { text: "End feed", bold: true },
        `${sec.feed.l} L x ${sec.feed.w} W`,
        { text: `Z${range(sec.feed.z)}`, align: "end" },
      ],
      ref: { part: "busway-end-feed" },
    },
    {
      cells: [
        { text: `Fiber trays x ${sec.fiber.trays.length}`, bold: true },
        `Y${range(sec.fiber.y)}`,
        { text: sec.fiber.trays.map(range).join(" / "), align: "end" },
      ],
      ref: { bom: "B3" },
    },
    {
      cells: [
        { text: "W headers / insulated OD", bold: true },
        `Y${fmt(sec.wHeader.y)} / ${fmtN(sec.wHeader.od, 1)}`,
        { text: `${sec.wHeader.z.map((z) => fmt(z)).join(" / ")} centers`, align: "end" },
      ],
      ref: { bom: "B8" },
    },
    {
      cells: [
        { text: "C headers / insulated OD", bold: true },
        `Y${fmt(sec.cHeader.y)} / ${fmtN(sec.cHeader.od, 1)}`,
        { text: `${sec.cHeader.z.map((z) => fmt(z)).join(" / ")} centers`, align: "end" },
      ],
      ref: { bom: "M7" },
    },
    {
      cells: [
        { text: "Drained wet-zone tray", bold: true },
        `Y${range(sec.leakTray.y)}`,
        { text: `Z${range(sec.leakTray.z)}`, align: "end" },
      ],
      ref: { bom: "C2" },
    },
    {
      cells: [
        { text: "Inner flat ceiling", bold: true },
        `${fmt(d.geometry.clearW)} mm wide`,
        { text: `Z${fmt(ch.flatCeiling)}`, align: "end" },
      ],
      ref: { bom: "S8" },
    },
  ];

  const clearances: Row[] = d.clearances.map((c) => ({
    cells: [c.label, { text: c.text, align: "end", bold: true }],
    fill: c.value > 0 ? "white" : "dark",
  }));

  return (
    <g>
      <SectionTitle x={13} y={64}>
        01 CROSS-SECTION / DIMENSIONS ABOVE FLOOR
      </SectionTitle>
      <Txt x={89} y={75} size={1.3} anchor="middle" bold>
        {`${fmt(H)} deployed / ${fmt(ch.flatCeiling)} flat ceiling clear`}
      </Txt>
      <View x={28} y={80} scale={S}>
        <ComputeSection data={data} d={d} zMin={Z_MIN} />
        <Dim x1={0} y1={0} x2={0} y2={roofH} offset={-8} text={`+${fmt(roofH)} mm roof module`} />
        <Dim
          x1={0}
          y1={H - Z_MIN}
          x2={ch.width}
          y2={H - Z_MIN}
          offset={5}
          textSide="below"
          text={`${fmt(ch.width)} base / ${fmt(ch.width)} external flat top / ${fmt(d.geometry.clearW)} inner flat span`}
        />
      </View>

      <SectionTitle x={193} y={64}>
        02 SERVICE ENVELOPES / mm ABOVE FINISHED FLOOR
      </SectionTitle>
      <Table x={193} y={72} cols={[{ w: 80 }, { w: 60 }, { w: 73 }]} rows={envelopes} rowH={8.5} size={1.15} />

      <SectionTitle x={193} y={155}>
        03 MINIMUM ENVELOPE CLEARANCES
      </SectionTitle>
      <Table x={193} y={162} cols={[{ w: 140 }, { w: 73 }]} rows={clearances} rowH={7} size={1.15} />
    </g>
  );
}

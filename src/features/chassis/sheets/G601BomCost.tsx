import { Box, LW, Para, Txt } from "@/features/chassis/drawing/core";
import { Table, type Col, type Row } from "@/features/chassis/drawing/Table";
import { fmt, usd } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";

const COLS: Col[] = [
  { w: 12 },
  { w: 104 },
  { w: 12, align: "middle" },
  { w: 8, align: "middle" },
  { w: 26, align: "end" },
  { w: 30, align: "end" },
];
const ROW_H = 3.75;
const TOP = 34;

export function BomCost() {
  const { data, d } = useSheetData();
  const bom = data.bom;

  const blocks: Row[][] = bom.areas.map((a) => {
    const lines = d.bom.lines.filter((l) => l.area === a.id);
    return [
      {
        cells: [{ text: a.label, bold: true }, "", "", "", "", { text: usd(d.bom.areaTotals[a.id]), bold: true }],
        fill: "dark",
        h: 4.4,
      },
      ...lines.map((l): Row => ({
        cells: [
          { text: l.id, bold: true },
          l.scope || l.part?.name || l.partId,
          fmt(l.qty),
          l.basis,
          usd(l.unitCost),
          usd(l.total),
        ],
        ref: { bom: l.id },
      })),
    ];
  });

  // Greedy split into two columns at roughly half the rows.
  const totalRows = blocks.reduce((s, b) => s + b.length, 0);
  const left: Row[] = [];
  const right: Row[] = [];
  for (const b of blocks) (right.length === 0 && left.length + b.length / 2 <= totalRows / 2 ? left : right).push(...b);

  const header: Row = {
    cells: ["ID", "Scope", "Qty", "B", "Unit", "Extended"].map((t, i) => ({
      text: t,
      bold: true,
      align: i < 2 ? "start" : COLS[i].align,
    })),
    fill: "light",
    h: 4.6,
  };

  return (
    <g>
      <Table x={12} y={TOP} cols={COLS} rows={[header, ...left]} rowH={ROW_H} size={1.05} pad={1.1} />
      <Table x={212} y={TOP} cols={COLS} rows={[header, ...right]} rowH={ROW_H} size={1.05} pad={1.1} />

      <Box x={212} y={238} w={192} h={12} fill="light" sw={LW.thick} />
      <Txt x={215} y={242.5} size={1.9} bold>
        {`TOTAL ${usd(d.bom.total)}`}
      </Txt>
      <Txt x={215} y={247} size={1.15}>
        {`${d.bom.lines.length} lines / ${d.bom.uniqueIds} unique IDs / ${bom.totalNote}`}
      </Txt>
      <Txt x={401} y={242.5} size={1.15} anchor="end">
        {bom.areas.map((a) => `${a.label.split(" ")[0]} ${usd(d.bom.areaTotals[a.id])}`).join(" / ")}
      </Txt>
      <Para x={12} y={TOP + (left.length + 1) * ROW_H + 8} w={192} size={1.1} text={bom.basisNote} />
    </g>
  );
}

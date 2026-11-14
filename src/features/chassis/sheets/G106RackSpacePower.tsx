import { Box, Hit, LW, Para, paraHeight, SectionTitle, Txt } from "@/features/chassis/drawing/core";
import { TitledPanel, Table, type Row } from "@/features/chassis/drawing/Table";
import { dimsText, fmt, fmtN } from "@/features/chassis/model/format";
import { groupSlots, SLOT_FILL } from "@/features/chassis/model/rackText";
import { useSheetData } from "./useSheetData";

const U_PX = 3.6;
const COL_W = 53;

export function RackSpacePower() {
  const { data, d } = useSheetData();
  const bay = data.racks.bay;
  const sys = data.electrical.system;

  // One column per rack type in physical order.
  const columns: { typeId: string; title: string }[] = [];
  for (const r of d.racks) {
    if (columns.some((c) => c.typeId === r.type.id)) continue;
    const same = d.racks.filter((x) => x.type.id === r.type.id);
    columns.push({
      typeId: r.type.id,
      title: same.length > 1 ? `${r.type.label} x ${same.length}` : `${same.map((x) => x.id).join(", ")} / CENTER`,
    });
  }

  const top = 54;
  const colX = (i: number) => 23 + i * 73;

  const pduRows: Row[] = [
    {
      cells: [
        { text: "Reference", bold: true },
        { text: "Quantity", bold: true, align: "middle" },
        { text: "Body W x D x H", bold: true, align: "end" },
      ],
      fill: "light",
      h: 6.5,
    },
    ...[...d.power.pdus.byPart].map(([partId, qty]) => {
      const p = d.partsById.get(partId);
      const mfr = (p?.manufacturer ?? "").split(" ")[0];
      const reserve = p?.notes.includes("reserve") ? " reserve" : "";
      return {
        cells: [
          `${mfr} ${p?.sku ?? partId} (${p?.ratings.amps ?? "?"} A, ${p?.ratings.mount ?? ""})`,
          { text: String(qty), align: "middle" as const },
          { text: dimsText(p?.dims) + reserve, align: "end" as const },
        ],
        ref: { part: partId },
        h: 6.5,
      };
    }),
  ];
  const pduNote = `${d.power.pdus.vertical} vertical + ${d.power.pdus.horizontal} horizontal = ${d.power.pdus.total} IT PDUs. ${data.sheets.sheets.find((s) => s.id === "G-106")?.notes[0]?.body ?? ""}`;

  const roles = [...d.power.byType.values()].filter(
    (rp, i, all) => all.findIndex((x) => x.rack.type.role === rp.rack.type.role) === i,
  );

  let capY = 110 + paraHeight(sys.note, 154, 1.15);

  return (
    <g>
      <SectionTitle x={13} y={38}>
        01 RACK SPACE / BOTTOM TO TOP
      </SectionTitle>
      {columns.map((c, ci) => {
        const type = d.rackTypes.get(c.typeId)!;
        const groups = groupSlots(type, d);
        const x = colX(ci);
        return (
          <g key={c.typeId}>
            <Txt x={x + COL_W / 2} y={top - 6} size={1.4} anchor="middle" bold>
              {c.title}
            </Txt>
            {groups.map((g) => {
              const y = top + (bay.units - g.uEnd) * U_PX;
              const h = (g.uEnd - g.uStart + 1) * U_PX;
              const part = g.slots[0].part;
              const body = (
                <>
                  <Box
                    x={x}
                    y={y}
                    w={COL_W}
                    h={h}
                    fill={SLOT_FILL[g.kind]}
                    sw={LW.thin}
                    label={[g.label]}
                    labelSize={h < 3 ? 0.85 : 1.1}
                    firstBold={h > 10}
                  />
                  <Txt x={x - 2} y={y + h / 2} size={0.85} anchor="end">
                    {`${g.uStart}-${g.uEnd}`}
                  </Txt>
                </>
              );
              return part ? (
                <Hit key={g.uStart} part={part}>
                  {body}
                </Hit>
              ) : (
                <g key={g.uStart}>{body}</g>
              );
            })}
            <Txt x={x + COL_W / 2} y={top + bay.units * U_PX + 5} size={1.15} anchor="middle" bold>
              {`+ ${type.zeroU.length} vertical 0U PDUs`}
            </Txt>
          </g>
        );
      })}

      <TitledPanel x={252} y={34} w={154} title={`02 IT PDUs / ${d.power.pdus.total} TOTAL`} />
      <Table x={252} y={42} cols={[{ w: 70 }, { w: 34 }, { w: 50 }]} rows={pduRows} size={1.1} />
      <Para x={252} y={42 + pduRows.length * 6.5 + 4} w={154} size={1.1} text={pduNote} />

      <TitledPanel x={252} y={96} w={154} title="03 CAPACITY PER A OR B BANK" />
      <Para x={252} y={106} w={154} size={1.15} text={sys.note} />
      {roles.map((rp) => {
        const bank = rp.banks[0];
        const groups = new Map<number, number>();
        for (const a of bank.breakers) groups.set(a, (groups.get(a) ?? 0) + 1);
        const y = (capY += 7);
        capY += 16;
        return (
          <g key={rp.rack.type.id}>
            <Txt x={252} y={y} size={1.3} bold>
              {`${rp.rack.type.role === "compute" ? "COMPUTE" : "CENTRAL IT"}: ${[...groups].map(([a, n]) => `${n} x ${a} A`).join(" + ")} per bank`}
            </Txt>
            <Txt x={252} y={y + 5} size={1.25}>
              {`sqrt(${sys.phases}) x ${sys.vLL} x ${fmt(bank.designAmps)} / 1,000 = ${fmtN(bank.kVA, 1)} kVA`}
            </Txt>
            <Txt x={252} y={y + 10.5} size={1.7} bold>
              {`${fmtN(bank.kW, 1)} kW at PF ${sys.pf} ${bank.kW >= rp.rack.kw ? ">" : "<"} ${rp.rack.kw} kW rack cap`}
            </Txt>
          </g>
        );
      })}
      <Para x={252} y={capY + 4} w={154} size={1.1} text={data.electrical.checksNote} />
    </g>
  );
}

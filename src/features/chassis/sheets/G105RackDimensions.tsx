import { Box, DASH, Dim, Hit, Line, LW, Para, SectionTitle, Txt, View } from "@/features/chassis/drawing/core";
import { TitledPanel, Table, type Row } from "@/features/chassis/drawing/Table";
import { ComputeSection } from "@/features/chassis/drawing/computeSection";
import { fmt, fmtN, pad2 } from "@/features/chassis/model/format";
import { uRange } from "@/features/chassis/model/calc";
import { SLOT_FILL } from "@/features/chassis/model/rackText";
import { useSheetData } from "./useSheetData";

const S = 0.075;

const KIND_TITLE: Record<string, string> = {
  node: "GPU nodes",
  cdu: "Bottom CDU",
  pdu: "Horizontal IT PDUs",
  aux: "Protected AUX panel",
  spare: "Remaining spare",
  network: "Fabric switches",
  storage: "Storage",
  patch: "Patching",
  oob: "OOB",
  mgmt: "Management",
};

export function RackDimensions() {
  const { data, d } = useSheetData();
  const bay = data.racks.bay;
  const ch = data.pods.chassis;
  const type = data.racks.types.find((t) => t.role === "compute") ?? data.racks.types[0];
  const audit = d.uAudit.find((a) => a.typeId === type.id)!;
  const uH = bay.unitHeight;
  const base = (bay.height - d.geometry.usableRack) / 2;
  const uTop = (u: number) => bay.height - base - u * uH;
  const faceX = (bay.pitch - bay.equipmentFace) / 2;
  const zeroU = d.partsById.get(type.zeroU[0]?.part ?? "");

  const slotLabel = (s: (typeof type.slots)[number]) => {
    if (s.kind === "node") return `${s.label} / ${uRange(s)}`;
    if (s.kind === "spare") return s.label;
    return `${s.label} / ${s.uHeight}U`;
  };

  const order = ["node", "cdu", "pdu", "aux", "spare", "network", "storage", "patch", "oob", "mgmt"];
  const audits: Row[] = Object.entries(audit.byKind)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([kind, v]) => {
      const slots = type.slots.filter((s) => s.kind === kind);
      const mid = kind === "spare" ? slots.map((s) => uRange(s)).join(", ") : `${v.count} x ${slots[0]?.uHeight ?? 0}U`;
      return {
        cells: [
          (kind === "node" ? `${v.count} ` : "") + KIND_TITLE[kind],
          { text: mid, align: "middle" },
          { text: `${v.units}U`, align: "end", bold: true },
        ],
        ref: slots[0]?.part ? { part: slots[0].part } : undefined,
        h: 6.5,
      };
    });
  const ok = audit.overlaps.length === 0 && audit.outOfRange.length === 0;
  audits.push({
    cells: [
      { text: ok ? "TOTAL / NO OVERLAPS" : "TOTAL / OVERLAPS FOUND", bold: true },
      { text: `${audit.assigned} slots assigned`, align: "middle" },
      { text: `${audit.assigned}U`, align: "end", bold: true },
    ],
    h: 6.5,
  });

  const fitNote = `0U: two rear-corner zones, each ${bay.zeroUZone.w} W x ${bay.zeroUZone.d} D x ${fmt(bay.zeroUZone.h)} H; PDU bodies ${fmtN(zeroU?.dims?.w)} x ${fmtN(zeroU?.dims?.d)} x ${fmt(zeroU?.dims?.h)}. AUX reserve: ${bay.auxReserve.w} W x ${bay.auxReserve.d} D x ${bay.auxReserve.h} H. Leak tray below U1. Clear pod width: ${bay.frontZone} front + ${fmt(bay.depth)} bay + ${bay.rdhxDepth} RDHx + ${bay.rearReturn} return = ${fmt(d.geometry.bayStack)}.`;

  return (
    <g>
      <SectionTitle x={13} y={33}>
        {`01 CUSTOM ${bay.pitch} BAY / FRONT`}
      </SectionTitle>
      <SectionTitle x={117} y={33}>
        02 RACK / SIDE + REAR CONNECTIONS
      </SectionTitle>

      {/* Front elevation */}
      <View x={44} y={50} scale={S}>
        <Hit part={type.frame}>
          <Box x={0} y={0} w={bay.pitch} h={bay.height} fill="white" sw={LW.thick} />
        </Hit>
        {Array.from({ length: bay.units }, (_, i) => (
          <Txt key={i} x={-60} y={uTop(i + 1) + uH / 2} size={0.75} anchor="end">
            {pad2(i + 1)}
          </Txt>
        ))}
        {type.slots.map((s) => {
          const w = s.kind === "aux" ? bay.auxReserve.w * 1.08 : bay.equipmentFace;
          const x = s.kind === "aux" ? (bay.pitch - w) / 2 : faceX;
          const body = (
            <Box
              x={x}
              y={uTop(s.uStart + s.uHeight - 1)}
              w={w}
              h={s.uHeight * uH}
              fill={SLOT_FILL[s.kind]}
              sw={LW.thin}
              label={[slotLabel(s)]}
              labelSize={s.uHeight < 2 ? 0.75 : 0.95}
            />
          );
          return s.part ? (
            <Hit key={s.uStart} part={s.part}>
              {body}
            </Hit>
          ) : (
            <g key={s.uStart}>{body}</g>
          );
        })}
        <Dim
          x1={0}
          y1={bay.height}
          x2={bay.pitch}
          y2={bay.height}
          offset={6}
          textSide="below"
          text={`${bay.pitch} custom bay pitch`}
        />
        <Dim
          x1={0}
          y1={0}
          x2={0}
          y2={bay.height}
          offset={-14}
          text={`${fmt(bay.height)} bay / ${bay.units}U = ${fmtN(d.geometry.usableRack, 1)} usable pitch`}
        />
      </View>

      {/* Side elevation */}
      <View x={127} y={50} scale={S}>
        <Hit part={type.frame}>
          <Box x={0} y={0} w={bay.depth} h={bay.height} fill="white" sw={LW.thick} />
        </Hit>
        {type.slots
          .filter((s) => s.part)
          .map((s) => {
            const part = d.partsById.get(s.part!);
            const depth = s.kind === "cdu" ? (part?.dims?.d ?? 1000) : (part?.dims?.d ?? 750);
            const h = s.kind === "node" ? (part?.dims?.h ?? s.uHeight * uH) : s.uHeight * uH;
            const y = uTop(s.uStart + s.uHeight - 1) + (s.uHeight * uH - h) / 2;
            const label =
              s.kind === "node"
                ? `${fmtN(part?.dims?.d)} D / ${fmtN(part?.dims?.h)} H`
                : s.kind === "cdu"
                  ? `${fmt(depth)} D RESERVE / ${s.uHeight}U`
                  : "";
            return (
              <Hit key={s.uStart} part={s.part}>
                <Box
                  x={bay.frontOffset}
                  y={y}
                  w={depth}
                  h={h}
                  fill={SLOT_FILL[s.kind]}
                  sw={LW.thin}
                  dash={s.kind === "cdu" ? DASH.fine : null}
                  label={label ? [label] : []}
                  labelSize={0.9}
                  firstBold={false}
                />
              </Hit>
            );
          })}
        {zeroU && (
          <Hit part={zeroU.partId}>
            <Box
              x={bay.depth - bay.zeroUZone.d - 20}
              y={bay.height - 100 - bay.zeroUZone.h}
              w={bay.zeroUZone.d}
              h={bay.zeroUZone.h}
              fill="none"
              dash={DASH.fine}
              sw={LW.thin}
            />
            <Box
              x={bay.depth - bay.zeroUZone.d + 20}
              y={bay.height - 100 - (zeroU.dims?.h ?? 1958)}
              w={zeroU.dims?.d ?? 71}
              h={zeroU.dims?.h ?? 1958}
              fill="light"
              sw={LW.thin}
            />
            <Txt
              x={bay.depth - bay.zeroUZone.d / 2 - 20}
              y={bay.height / 2 - 100}
              size={0.95}
              anchor="middle"
              rotate={-90}
              bold
            >
              REAR-CORNER 0U PDU / EACH SIDE
            </Txt>
          </Hit>
        )}
        <Line x1={0} y1={bay.height + 60} x2={bay.depth} y2={bay.height + 60} sw={LW.thin} />
        <Dim
          x1={0}
          y1={bay.height}
          x2={bay.depth}
          y2={bay.height}
          offset={6}
          textSide="below"
          text={`${fmt(bay.depth)} bay depth`}
        />
      </View>

      {/* 03 fit audit */}
      <TitledPanel x={252} y={31} w={154} title="03 RACK U / COMPONENT FIT AUDIT" />
      <Table x={252} y={39} cols={[{ w: 62 }, { w: 62 }, { w: 30 }]} rows={audits} size={1.15} />
      <Para x={252} y={39 + audits.length * 6.5 + 4} w={154} size={1.1} text={fitNote} />

      {/* 04 raised roof at 1:50 */}
      <TitledPanel x={252} y={110} w={154} title="04 RAISED SERVICE ROOF / SECTION 1:50" />
      <View x={268} y={119} scale={1 / 50}>
        <ComputeSection data={data} d={d} zMin={1900} labels={false} />
      </View>
      <Txt x={322} y={125} size={1.15} bold>
        {`${fmt(ch.flatCeiling)} flat ceiling clear`}
      </Txt>
      <Txt x={322} y={174} size={1.15} bold>
        {`Rack top ${fmt(bay.height)}`}
      </Txt>
      <Para
        x={252}
        y={185}
        w={154}
        size={1.1}
        text={`Flat ceiling ${fmt(ch.flatCeiling)} / ${fmt(d.geometry.clearW)} wide inner flat span above floor. Tap withdrawal Z${fmt(data.racks.section.tap.withdrawal)} leaves ${fmt(data.racks.section.tap.withdrawal - bay.height)} mm above racks. Fiber trays rise to Z${data.racks.section.fiber.trays.map((t) => fmt(t[0])).join(" / ")}. Full coordinates and envelope checks: G-108.`}
      />

      {/* 05 transport */}
      <TitledPanel
        x={252}
        y={196}
        w={154}
        title={`05 TRANSPORT / 1:80 / ${fmt(d.geometry.transportHeight)} mm LOADED`}
      />
      <View x={290} y={206} scale={1 / 80}>
        <Hit bom="S2">
          <Box
            x={0}
            y={0}
            w={ch.length}
            h={ch.transitHeight}
            fill="light"
            sw={LW.med}
            label={[
              `${fmt(ch.length)} L x ${fmt(ch.width)} W x ${fmt(ch.transitHeight)} H`,
              "CUSTOM POD / NOT ISO CERTIFIED",
            ]}
            labelSize={1.0}
          />
        </Hit>
        {Array.from({ length: 13 }, (_, i) => (
          <Line
            key={i}
            x1={300 + i * 450}
            y1={ch.transitHeight - 700}
            x2={300 + i * 450}
            y2={ch.transitHeight - 80}
            sw={LW.hair}
          />
        ))}
        <Box x={-200} y={ch.transitHeight} w={ch.length + 400} h={ch.transport.dunnage} fill="dark" sw={LW.thin} />
        <Box
          x={-400}
          y={ch.transitHeight + ch.transport.dunnage}
          w={ch.length + 800}
          h={ch.transport.trailerDeck}
          fill="white"
          sw={LW.med}
        />
        <Dim
          x1={-400}
          y1={0}
          x2={-400}
          y2={ch.transitHeight + ch.transport.dunnage + ch.transport.trailerDeck}
          offset={-6}
          text={`${fmt(ch.transitHeight)} + ${ch.transport.dunnage} + ${ch.transport.trailerDeck} = ${fmt(d.geometry.transportHeight)}`}
          size={1.1}
        />
      </View>
    </g>
  );
}

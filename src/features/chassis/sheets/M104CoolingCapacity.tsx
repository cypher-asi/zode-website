import { Para, SectionTitle, Txt } from "@/features/chassis/drawing/core";
import { Table, type Row } from "@/features/chassis/drawing/Table";
import { fmt, fmtN } from "@/features/chassis/model/format";
import { useSheetData } from "./useSheetData";

export function CoolingCapacity() {
  const { data, d } = useSheetData();
  const t = d.thermal;
  const c = data.cooling.design;
  const coil = data.pods.roofProfiles.find((r) => r.coil)?.coil;
  const pct = Math.round(c.dtcFraction * 100);
  const roofOk = t.roofReqKw >= t.dtcKw;

  const heat: Row[] = [
    {
      cells: [
        { text: "TOTAL IT HEAT", bold: true },
        { text: `${fmt(t.totalKw)} kW`, bold: true, size: 1.9 },
        `${fmt(t.computeKw)} kW compute + ${fmt(t.centralKw)} kW network / storage`,
      ],
    },
    {
      cells: [
        { text: "DTC / WARM LOOP", bold: true },
        { text: `${fmt(t.dtcKw)} kW`, bold: true, size: 1.9 },
        `${pct}% of compute; roofs first, then HX-1 chiller-assisted trim`,
      ],
      ref: { bom: "R2" },
    },
    {
      cells: [
        { text: "REAR-DOOR / CHW LOAD", bold: true },
        { text: `${fmt(t.rdhxLoadKw)} kW`, bold: true, size: 1.9 },
        `${fmt(t.computeAirKw)} kW compute air heat + ${fmt(t.centralKw)} kW central IT; separate CHW path`,
      ],
      ref: { bom: "R4" },
    },
    {
      cells: [
        { text: "ROOF SELECTION REQUIREMENT", bold: true },
        { text: `${t.roofCount} x >=${fmt(c.roofMinKw)} kW`, bold: true, size: 1.9 },
        c.roofFluid,
      ],
      ref: { bom: "M3C" },
    },
    {
      cells: [
        { text: "CHILLER / MILD WEATHER", bold: true },
        { text: `${fmt(t.rdhxLoadKw)} kW + auxiliaries`, bold: true, size: 1.9 },
        `If roofs meet the ${fmt(t.dtcKw)} kW DTC duty; otherwise add warm-loop shortfall`,
      ],
      ref: { bom: "M5" },
    },
    {
      cells: [
        { text: "CHILLER / HOT DESIGN DAY", bold: true },
        { text: `${fmt(t.totalKw)} kW + auxiliaries`, bold: true, size: 1.9 },
        `Zero roof duty credit at +${c.designAmbientC} C; select M5 for ${fmt(c.chillerNetKw)} kW NET cooling`,
      ],
      ref: { bom: "M5" },
    },
  ];

  const screen: Row[] = [
    {
      cells: [
        { text: `Reference airflow / ${t.fansPerRoof} fans per roof`, bold: true },
        `${t.fansPerRoof} x ${fmt(c.fanAirflowM3h)} m3/h = ${fmt(t.airflowRoofM3h)} m3/h = ${fmtN(t.airflowRoofM3s, 2)} m3/s at cited fan point`,
      ],
      ref: { bom: "M3A" },
    },
    {
      cells: [
        { text: `Air-side heat at ${c.airDeltaT} K rise`, bold: true },
        `${fmtN(t.airflowRoofM3s, 2)} x ${c.airDensity} kg/m3 x ${fmtN(c.airCp, 1)} kJ/kg-K x ${c.airDeltaT} K = ${fmtN(t.airHeatRoofKw, 1)} kW/roof; ${fmtN(t.airHeatRoofKw * t.roofCount, 1)} kW/pair`,
      ],
    },
    {
      cells: [
        { text: "Coil face / velocity", bold: true },
        coil
          ? `${coil.banks} x ${fmtN(coil.length / 1000, 3)} x ${fmtN(coil.slant / 1000, 3)} = ${fmtN(t.coilFaceM2, 2)} m2/roof; ~${fmtN(t.coilVelocity, 2)} m/s at reference airflow`
          : "No coil profile defined",
      ],
      ref: { bom: "M3C" },
    },
    {
      cells: [
        { text: `Airflow needed for ${fmt(c.roofMinKw)} kW/roof`, bold: true },
        `${fmt(t.airflowNeededM3h)} m3/h total / ${fmt(t.airflowPerFanM3h)} m3/h per fan at actual coil + intake resistance`,
      ],
    },
    {
      cells: [
        { text: `Liquid flow for ${fmt(c.roofMinKw)} kW/roof`, bold: true },
        `${fmt(c.roofMinKw)} / (${fmtN(c.fluidCp, 1)} kJ/L-K x ${c.fluidDeltaT} K) = ${fmtN(t.liquidLps, 1)} L/s each; ${fmt(t.liquidPairLps)} L/s pair vs ${c.roofReserveFlowLps} L/s reserve`,
      ],
      fill: t.liquidPairLps <= c.roofReserveFlowLps ? "white" : "dark",
    },
    {
      cells: [
        { text: "Fan / electrical status", bold: true },
        `Reference fan is not selected; ${t.fansPerRoof} x ${fmtN(c.fanMaxKw, 2)} = ${fmtN(t.fanKwRoof, 2)} kW max-load reference/roof; retain ${c.roofFeederKw} kW feeders`,
      ],
      ref: { bom: "E6" },
    },
  ];

  return (
    <g>
      <SectionTitle x={13} y={40}>
        {`01 REQUIRED HEAT PATHS / ${fmtN(t.totalKw / 1000, 0)} MW IT`}
      </SectionTitle>
      <Table x={13} y={46} cols={[{ w: 110 }, { w: 90 }, { w: 194 }]} rows={heat} rowH={12} size={1.45} pad={4} />
      <Txt x={15} y={128} size={1.6} bold>
        TWO ROWS IMPROVE THE AIRFLOW SCREEN; RATED COIL DUTY IS STILL REQUIRED.
      </Txt>
      <Para
        x={15}
        y={133}
        w={390}
        size={1.4}
        text={`${fmt(t.roofReqKw)} kW combined roof requirement ${roofOk ? "exceeds" : "is BELOW"} the ${fmt(t.dtcKw)} kW DTC load by ${fmt(Math.abs(t.roofMarginKw))} kW. This is a procurement requirement, not achieved performance.`}
      />

      <SectionTitle x={13} y={150}>
        02 AIR / COIL / LIQUID SCREENING
      </SectionTitle>
      <Table x={13} y={156} cols={[{ w: 120 }, { w: 274 }]} rows={screen} rowH={12} size={1.4} pad={4} />
    </g>
  );
}

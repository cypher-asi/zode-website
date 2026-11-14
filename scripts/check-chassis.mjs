/**
 * Checks the Chassis app's calculations against NIRA Chassis I as issued:
 * the drawing set's BOM totals, rack audit, power banks, heat balance,
 * geometry and clearances, worked out from the seed design
 * (src/features/chassis/seed) as the app works them out on every edit.
 *
 *   npm run check:chassis
 */
import "./chassis-hooks.mjs";

const { seedDesign } = await import("../src/features/chassis/model/seed.ts");
const { derive } = await import("../src/features/chassis/model/calc.ts");
const { tpl } = await import("../src/features/chassis/model/format.ts");

const d = derive(seedDesign);

let failures = 0;
const report = (label, actual, expected, tolerance = 0) => {
  const ok =
    typeof expected === "number"
      ? typeof actual === "number" && Math.abs(actual - expected) <= tolerance
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  const shown = (value) => (typeof value === "number" ? String(value) : JSON.stringify(value));
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(44)} ${shown(actual).padStart(24)}  expected ${shown(expected)}`);
};

// G-601: the BOM.
report("Unique BOM IDs", d.bom.uniqueIds, 73);
report("BOM lines", seedDesign.bom.items.length, 73);
report("Area subtotals", d.bom.areaTotals, { compute: 1_007_624, cooling: 268_385, electrical: 579_385, outdoor: 760_700 });
report("BOM total", d.bom.total, 2_616_094);
const bomChecks = d.checks.filter((c) => c.group === "BOM vs model");
report("BOM quantities the model counts", bomChecks.length > 20, true);
report("BOM quantities off the model", bomChecks.filter((c) => c.status !== "pass").map((c) => c.id), []);
report("Shell breakdowns", d.shellTotals, { compute: 34_000, electrical: 36_385, cooling: 36_385 });
report("Compute roof (S8)", d.bom.lines.find((l) => l.id === "S8")?.total, 16_000);

// G-105 / G-106: racks.
for (const a of d.uAudit) {
  report(`${a.typeId} rack: U assigned, no overlaps`, [a.assigned, a.overlaps, a.outOfRange], [48, [], []]);
}
const compute = d.uAudit.find((a) => a.typeId === "compute");
report("Compute rack fit", compute?.byKind, {
  ...compute?.byKind,
  node: { count: 8, units: 32 },
  cdu: { count: 1, units: 4 },
  pdu: { count: 4, units: 8 },
  aux: { count: 1, units: 1 },
  spare: { count: 1, units: 3 },
});
report("IT PDUs, vertical + horizontal", [d.power.pdus.vertical, d.power.pdus.horizontal, d.power.pdus.total], [20, 36, 56]);
report("Usable rack pitch, mm", d.geometry.usableRack, 2133.6, 1e-5);

// G-106 / E-101: power.
const computeBank = d.power.byType.get("compute")?.banks[0];
report("Compute bank breakers", computeBank?.breakers, [100, 60, 60]);
report("Compute bank design A", computeBank?.designAmps, 176, 0.005);
report("Compute bank kVA", computeBank?.kVA, 126.5, 0.05);
report("Compute bank kW", computeBank?.kW, 120.2, 0.05);
const centralBank = d.power.byType.get("central-a")?.banks[1];
report("Central bank breakers", centralBank?.breakers, [100, 60]);
report("Central bank kVA", centralBank?.kVA, 92.0, 0.05);
report("Central bank kW", centralBank?.kW, 87.4, 0.05);
report("Busway taps", d.power.taps, 20);

// M-102 / M-104: heat balance and screening.
const t = d.thermal;
report("Compute kW", t.computeKw, 880);
report("Central kW", t.centralKw, 120);
report("Total kW", t.totalKw, 1000);
report("Direct-to-chip kW", t.dtcKw, 616, 0.005);
report("Compute air kW", t.computeAirKw, 264, 0.005);
report("RDHx load kW", t.rdhxLoadKw, 384, 0.005);
report("Roof required kW", t.roofReqKw, 700);
report("Roof margin kW", t.roofMarginKw, 84, 0.005);
report("Roof airflow m³/h", t.airflowRoofM3h, 143_580);
report("Roof airflow m³/s", t.airflowRoofM3s, 39.88, 0.005);
report("Roof air heat kW", t.airHeatRoofKw, 478.6, 0.05);
report("Coil face m²", t.coilFaceM2, 12.07, 0.005);
report("Coil velocity m/s", t.coilVelocity, 3.3, 0.05);
report("Airflow needed m³/h", t.airflowNeededM3h, 105_000, 0.005);
report("Airflow per fan m³/h", t.airflowPerFanM3h, 8_750, 0.005);
report("Liquid L/s", t.liquidLps, 10, 0.005);
report("Liquid pair L/s", t.liquidPairLps, 20, 0.005);
report("Roof fan kW", t.fanKwRoof, 8.76, 0.005);

// G-101 / G-103 / G-108: geometry and clearances.
const g = d.geometry;
report("Clear length × width", [g.clearL, g.clearW], [5758, 2138]);
report("Bay length × stack", [g.bayLength, g.bayStack], [5758, 2138]);
report("Tap rail", g.tapRail, 5651);
report("Roof length × width", [g.roofLen, g.roofWid], [6058, 2438]);
report("Row × body length", [g.rowLength, g.bodyLength], [18_288, 18_174]);
report("Transport × deployed height", [g.transportHeight, g.deployedHeight], [3958, 5000]);
report("Rear node depth", g.rearNode, 261.6, 0.005);
report("Rear CDU depth", g.rearCdu, 253, 0.005);
report("Node ahead of rear", g.aheadNode, 76.6, 0.005);
report("CDU ahead of rear", g.aheadCdu, 68, 0.005);
report(
  "G-108 clearances, mm",
  Object.fromEntries(d.clearances.map((c) => [c.label, Math.round(c.value)])),
  {
    "A-bus upper corner to roof": 1450,
    "Upper C-pipe box to flat ceiling": 1477,
    "Upper W-pipe box to flat ceiling": 1463,
    "End-feed corner to roof": 1504,
    "Upper fiber tray to ceiling": 1204,
    "Tap withdrawal to rack top": 416,
    "Lower W pipe to leak tray": 49,
  },
);

// Checks and the sheets' templated notes.
report("Failing checks", d.checks.filter((c) => c.status === "fail").map((c) => c.id), []);
report("Template: node count", tpl("{nodeCount} GPU NODES / TCS", d.vars), "64 GPU NODES / TCS");
report("Template: aux positions", tpl("{auxPositions}", d.vars), "Compute: U45 / central IT: U47");
report(
  "Template: chiller",
  tpl("{chillerMw} MW NET target at +{ambientC} C", d.vars),
  "1.10 MW NET target at +46 C",
);

// An edit flows through: a ninth compute rack overfills the row and the BOM.
const edited = structuredClone(seedDesign);
edited.racks.racks.push({ id: "C09", type: "compute", tap: "T11" });
const e = derive(edited);
report("Ninth rack: total kW", e.thermal.totalKw, 1110);
report("Ninth rack: bay length check", e.checks.find((c) => c.id === "bay-length")?.status, "fail");
report("Ninth rack: R1 quantity check", e.checks.find((c) => c.id === "qty-R1")?.status, "fail");

if (failures) {
  console.error(`\n${failures} value(s) differ from NIRA Chassis I as issued.`);
  process.exit(1);
}
console.log("\nThe Chassis app reproduces NIRA Chassis I as issued.");

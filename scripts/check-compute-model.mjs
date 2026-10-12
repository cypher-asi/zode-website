/**
 * Checks the compute model engine against the Base case cached in
 * ZODE_GPU_SPV_Model.xlsm. The workbook was built in Google Sheets with no
 * forecast start date, so month zero is its date epoch, 30 December 1899;
 * starting there reproduces its day counts and XIRR dates.
 *
 *   npm run check:model
 */
import { registerHooks } from "node:module";

// The app's TypeScript imports omit the extension, as the bundler allows.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { DEFAULT_INPUTS, withScenario } = await import("../src/features/compute-model/model/inputs.ts");
const { runModel } = await import("../src/features/compute-model/model/engine.ts");

const EPOCH = { year: 1899, month: 11, day: 30 };
// The workbook escalates base rent with the other fixed costs; the site defaults to its own 2.5%.
const WORKBOOK = { ...DEFAULT_INPUTS, leaseEscalation: DEFAULT_INPUTS.fixedEscalation };
const r = runModel(WORKBOOK, EPOCH);

const EXPECTED = [
  ["Equipment purchase", r.equipmentPurchase, 163_328_000],
  ["Contract value", r.contractValue, 359_055_360],
  ["Year 1 net revenue", r.year1Revenue, 88_805_376],
  ["Year 1 SPV EBITDA", r.year1Ebitda, 65_823_839.36],
  ["Year 1 net profit", r.year1NetProfit, 24_772_525.42],
  ["Contract net profit", r.contractNetProfit, 107_350_816.7],
  ["Lifetime net profit", r.lifetimeNetProfit, 124_923_742.1],
  ["Preferred equity required", r.prefEquity, 21_393_977.6],
  ["Preferred distributions", r.prefDistributions, 32_090_966.39],
  ["Preferred MOIC", r.prefMoic, 1.5],
  ["Preferred IRR", r.prefIrr, 0.4009574027],
  ["Common distributions", r.commonDistributions, 114_226_753.3],
  ["Shareholder profit", r.shareholderProfit, 124_923_742.1],
  ["Customer prepayment", r.prepayment, 107_716_608],
  ["Requested loan", r.requestedLoan, 69_454_364.8],
  ["Maximum DSCR loan", r.maxDscrLoan, 55_250_354.58],
  ["GPU loan", r.loan, 55_250_354.58],
  ["DSCR funding gap", r.dscrFundingGap, 14_204_010.22],
  ["Equity through first shipment", r.prefEquityAtShipment, 21_045_712.34],
  ["Later preferred equity calls", r.prefEquityLater, 348_265.2532],
  ["Reserve funded", r.reserveFunded, 5_525_035.458],
  ["Minimum quarterly DSCR", r.minQuarterlyDscr, 1.15],
  ["Minimum monthly DSCR", r.minMonthlyDscr, 0.3048986171],
  ["Year 1 DSCR", r.year1Dscr, 1.513258229],
  ["Quarterly DSCR breaches", r.dscrBreaches, 0],
  ["Debt at forecast end", r.debtAtEnd, 0],
  ["Peak reserve shortfall", r.peakReserveShortfall, 1_450_840.364],
  ["Year 1 lease / month", r.year1Lease, 904_000],
  ["Year 1 electricity / month", r.year1Electricity, 387_192],
];

const ANNUAL = [
  // Net revenue, SPV EBITDA, net profit, preferred calls, preferred paid, common paid, debt service (USD millions)
  [0, -0.3166666667, -0.3166666667, 21.04571234, 0, 0, 0],
  [88.805376, 65.82383936, 24.77252542, 0, 12.33559912, 0, 24.03390424],
  [88.805376, 65.18767649, 26.34637673, 0, 16.45306643, 0, 21.82389006],
  [88.805376, 64.53242873, 27.90114315, 0, 2.779902971, 20.75296534, 19.61387588],
  [89.0486784, 64.08163261, 28.64743805, 0, 0, 37.09718461, 0],
  [47.55527885, 23.06045636, -12.3737382, 0, 0, 23.64974583, 0],
  [40.76166758, 15.69640582, 30.39592582, 0, 0, 30.67511532, 0],
  [0, -0.4492621766, -0.4492621766, 0.3482652532, 0.5223978797, 2.051742221, 0],
];

const close = (actual, expected) =>
  actual !== null && Math.abs(actual - expected) <= Math.max(0.01, Math.abs(expected) * 1e-7);

let failures = 0;
const report = (label, actual, expected) => {
  const ok = close(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(36)} ${String(actual).padStart(22)}  expected ${expected}`);
};

for (const [label, actual, expected] of EXPECTED) report(label, actual, expected);

const m = r.monthly;
const series = [
  m.netRevenue,
  m.ebitda,
  m.netProfit,
  m.prefContributions,
  m.prefDistributions,
  m.commonDistributions,
  m.debtService,
];
r.periods.forEach((p, row) => {
  series.forEach((values, col) => {
    let total = 0;
    for (let k = p.from; k < p.to; k++) total += values[k];
    report(`${p.label} column ${col + 1}`, total / 1e6, ANNUAL[row][col]);
  });
});

// The other cases, recalculated in LibreOffice with the scenario cell changed.
const SCENARIO_CASES = {
  downside: {
    contractNetProfit: -25_732_856.5719929,
    lifetimeNetProfit: -27_335_934.1051335,
    prefEquity: 129_591_181.890415,
    prefDistributions: 102_255_247.785281,
    prefIrr: -0.379653979261658,
    loan: 0,
    prefUnrecovered: 53_719_191.5917658,
    prefReturnUnpaid: 39_256_253.6305851,
    moicShortfall: 92_131_525.0503411,
    prefEquityAtShipment: 70_771_031.4666667,
  },
  severe: {
    contractNetProfit: -66_772_405.0795865,
    lifetimeNetProfit: -68_375_482.612727,
    prefEquity: 143_197_312.390415,
    prefDistributions: 74_821_829.7776873,
    prefIrr: -0.574543998668735,
    loan: 0,
    prefUnrecovered: 95_484_319.5456611,
    prefReturnUnpaid: 79_576_542.2887871,
    moicShortfall: 139_974_138.807934,
    prefEquityAtShipment: 70_771_031.4666667,
  },
};

for (const [scenario, expected] of Object.entries(SCENARIO_CASES)) {
  const result = runModel(withScenario(WORKBOOK, scenario), EPOCH);
  for (const [key, value] of Object.entries(expected)) report(`${scenario} ${key}`, result[key], value);
}

if (failures) {
  console.error(`\n${failures} value(s) differ from the workbook.`);
  process.exit(1);
}
console.log("\nAll values match the workbook.");

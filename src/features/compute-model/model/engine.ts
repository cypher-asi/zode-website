/**
 * The ZODE GPU SPV model, ported from ZODE_GPU_SPV_Model.xlsm for one
 * deployment. Months run 0 to LAST_MONTH like the workbook's columns, and
 * each stage follows its sheet: Deployments and Facility Costs, the GPU
 * Financing loan sizing, debt schedule and reserve, then the Equity
 * waterfall and the Summary rollups.
 */
import {
  CONTRACT_CURVE,
  GPUS_PER_NODE,
  LAST_MONTH,
  OPERATING_MONTHS,
  type ModelInputs,
} from "./inputs";
import { xirr } from "./xirr";

export interface StartDate {
  year: number;
  /** 0 for January. */
  month: number;
  day: number;
}

export interface MonthlySeries {
  /** UTC milliseconds of each forecast month. */
  dates: number[];
  netRevenue: number[];
  ebitda: number[];
  netProfit: number[];
  capex: number[];
  debtBalance: number[];
  debtService: number[];
  netBookValue: number[];
  prefContributions: number[];
  prefDistributions: number[];
  commonDistributions: number[];
  cumulativeEquity: number[];
  cumulativeDistributions: number[];
  leaseCost: number[];
  electricity: number[];
}

export interface Period {
  label: string;
  /** First and one-past-last month index. */
  from: number;
  to: number;
}

/** A forecast that breaks an input rule, a covenant or a return target. */
export interface Check {
  id: string;
  message: string;
}

export interface ModelResult {
  gpus: number;
  itMw: number;
  facilityMw: number;
  firstOperatingMonth: number;
  equipmentPurchase: number;
  totalCapex: number;
  contractValue: number;

  year1Revenue: number;
  year1Ebitda: number;
  year1NetProfit: number;
  year1Lease: number;
  year1Electricity: number;
  contractNetProfit: number;
  lifetimeNetProfit: number;

  prefEquity: number;
  prefEquityAtShipment: number;
  prefEquityLater: number;
  prefDistributions: number;
  prefProfit: number;
  prefMoic: number | null;
  prefIrr: number | null;
  /** All equity, preferred and common, on its dated contributions and distributions. */
  equityIrr: number | null;
  /** Before GPU debt: operating cash, capex, prepayment and disposals. */
  projectIrr: number | null;
  prefUnrecovered: number;
  prefReturnUnpaid: number;
  moicShortfall: number;
  commonDistributions: number;
  shareholderProfit: number;

  prepayment: number;
  loan: number;
  requestedLoan: number;
  maxDscrLoan: number;
  dscrFundingGap: number;
  reserveFunded: number;
  peakReserveShortfall: number;
  minQuarterlyDscr: number | null;
  minMonthlyDscr: number | null;
  year1Dscr: number | null;
  dscrBreaches: number;
  debtAtEnd: number;

  monthly: MonthlySeries;
  periods: Period[];
  checks: Check[];
}

const MONTHS = LAST_MONTH + 1;
const HOURS = 24;

const zeros = () => new Array<number>(MONTHS).fill(0);
const sum = (values: readonly number[], from = 0, to = values.length) => {
  let total = 0;
  for (let i = from; i < to; i++) total += values[i];
  return total;
};
/** Spreadsheet ROUNDUP(x, 0): away from zero. */
const roundUp = (x: number) => Math.sign(x) * Math.ceil(Math.abs(x));
const clampIndex = (i: number, max: number) => Math.min(max, Math.max(1, i)) - 1;

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** The first of next month, the default forecast start. */
export function nextMonthStart(now = new Date()): StartDate {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: 1 };
}

export function runModel(inputs: ModelInputs, start: StartDate): ModelResult {
  const i = inputs;
  const ship = i.shipMonth;
  const order = ship - i.leadMonths;
  const term = i.contractMonths;
  const loanTerm = i.loanMonths;
  const io = i.interestOnlyMonths;
  const sale = i.forcedSaleMonth;
  const firstOp = ship + 1;
  const lastContract = ship + term;

  const nodePlusIt = i.nodeCost * (1 + i.itShare);
  const equipCost = i.nodes * nodePlusIt;
  const useTax = i.purchaseTax * (1 - i.taxExempt);
  const itMw = (i.nodes * i.kwPerNode) / 1000;
  const itKw = itMw * 1000;
  const gpus = i.nodes * GPUS_PER_NODE;
  const depreciable =
    (equipCost * (1 + i.spareShare) * (1 + useTax + i.importTax) + i.setupCost) * (1 - i.bookResidual);
  const siteCost = i.sitePurchase + i.siteConversion;
  const siteProceeds = i.sitePurchase * i.siteResidual * (1 - i.sellingCosts);

  // Calendar
  const dates = zeros();
  const days = zeros();
  for (let m = 0; m < MONTHS; m++) {
    const y = start.year;
    const mo = start.month + m;
    const dim = daysInMonth(y, mo);
    days[m] = dim;
    dates[m] = Date.UTC(y, mo, Math.min(start.day, dim));
  }

  // Deployment flags
  const age = zeros().map((_, m) => m - ship);
  const acq = age.map((a) => (a === 0 ? 1 : 0));
  const forced = age.map((a) => (sale > 0 && a >= sale ? 1 : 0));
  const recovery = age.map((a) => (sale > 0 && a === sale + i.recoveryDelay ? 1 : 0));
  const ending = age.map((a, m) => (a === OPERATING_MONTHS && forced[m] === 0 ? 1 : 0));
  const op = age.map((a) => (a > 0 && a <= OPERATING_MONTHS && (sale === 0 || a < sale) ? 1 : 0));
  const contract = age.map((a) => (a > 0 && a <= term ? 1 : 0));
  const escalation = (rate: number, a: number) => (1 + rate) ** Math.max(0, roundUp(a / 12) - 1);

  // Deployments: revenue
  const scheduled = zeros();
  const merchantUtil = zeros();
  const netRevenue = zeros();
  const contractedRevenue = zeros();
  for (let m = 0; m < MONTHS; m++) {
    const a = age[m];
    const gpuHours = gpus * days[m] * HOURS;
    const rate = CONTRACT_CURVE[clampIndex(roundUp(a / 12), CONTRACT_CURVE.length)] * i.contractPrice * contract[m];
    scheduled[m] = gpuHours * i.contractedShare * rate;

    const year = clampIndex(roundUp((a - term) / 12), 5);
    const price = i.merchantPrices[year] * i.merchantPriceFactor * op[m];
    const ramp = a === 1 ? i.rampMonth1 : a === 2 ? i.rampMonth2 : 1;
    merchantUtil[m] = Math.min(1, i.merchantUtilization[year] * i.utilizationFactor * ramp) * op[m];

    contractedRevenue[m] = scheduled[m] * op[m];
    const merchant = gpuHours * (1 - i.contractedShare * contract[m]) * price * merchantUtil[m];
    const gross = contractedRevenue[m] + merchant;
    netRevenue[m] = gross - gross * i.slaCredits - merchant * (1 - i.slaCredits) * i.marketplaceFee;
  }
  const contractValue = sum(scheduled);
  const totalPrepayment = contractValue * i.prepaymentShare;

  // Deployments and Facility Costs: costs, capex, assets
  const leaseCost = zeros();
  const electricity = zeros();
  const opex = zeros();
  const ebitda = zeros();
  const depreciation = zeros();
  const collections = zeros();
  const prepayment = zeros();
  const capex = zeros();
  const equipment = zeros();
  const spares = zeros();
  const netBookValue = zeros();
  const gain = zeros();
  const writeOff = zeros();
  const refund = zeros();
  const disposalProceeds = zeros();
  const incomeBefore = zeros();

  let receivables = 0;
  let nbv = 0;
  let unearned = 0;
  for (let m = 0; m < MONTHS; m++) {
    const a = age[m];
    const fixed = escalation(i.fixedEscalation, a) * op[m];

    const lease = itKw * (i.baseLease + i.nnn + i.operations) * fixed;
    const share = i.contractedShare * contract[m];
    const load = i.idleLoad + (1 - i.idleLoad) * (share + (1 - share) * merchantUtil[m]);
    const kwh = itKw * i.pue * days[m] * HOURS * load * op[m];
    const power = kwh * i.electricityRate * escalation(i.electricityEscalation, a);
    const insurance = (equipCost * i.insuranceRate) / 12;
    const support = (equipCost * i.supportRate) / 12;
    const perDeployment = i.internet + i.remoteHands + i.software + i.overhead + i.otherInsurance / 12;
    const beforeContingency = lease + power + (insurance + support + perDeployment) * fixed;
    leaseCost[m] = lease;
    electricity[m] = power;
    opex[m] = beforeContingency * (1 + i.contingency) + netRevenue[m] * i.managementFee;
    ebitda[m] = netRevenue[m] - opex[m];

    depreciation[m] = a > 0 && a <= i.depreciationMonths ? (depreciable / i.depreciationMonths) * op[m] : 0;

    const prepayCredit = contractedRevenue[m] * i.prepaymentShare;
    const closingReceivables = Math.max(0, netRevenue[m] - prepayCredit) * Math.min(1, i.receivableDays / days[m]);
    collections[m] = forced[m] ? 0 : netRevenue[m] - prepayCredit - (closingReceivables - receivables);
    const saleStarts = forced[m] === 1 && (m === 0 || forced[m - 1] === 0);
    writeOff[m] = saleStarts && m > 0 ? receivables : 0;
    refund[m] = saleStarts && m > 0 ? unearned : 0;
    receivables = closingReceivables;

    prepayment[m] = m === order ? totalPrepayment : 0;
    unearned = unearned + prepayment[m] - prepayCredit - refund[m];

    equipment[m] = equipCost * acq[m];
    spares[m] = equipment[m] * i.spareShare;
    const importTax = equipment[m] * (1 + i.spareShare) * i.importTax;
    const purchaseTax = equipment[m] * (1 + i.spareShare) * useTax;
    const setup = i.setupCost * acq[m];
    const additions = equipment[m] + spares[m] + importTax + purchaseTax + setup;
    capex[m] =
      equipment[m] + setup + purchaseTax + spares[m] - equipment[m] * i.deposit + (m === order ? equipCost * i.deposit : 0) + importTax;
    if (m === order) capex[m] += siteCost;

    const carrying = recovery[m] || ending[m] ? Math.max(0, nbv - depreciation[m]) : 0;
    nbv = Math.max(0, nbv + additions - depreciation[m] - carrying);
    netBookValue[m] = nbv;

    const recoveryFactor = i.recovery[clampIndex(roundUp(a / 12), 5)];
    const forcedProceeds =
      Math.max(
        0,
        equipCost * (1 - i.hardwareDecline) ** Math.max(0, a / 12) * recoveryFactor * (1 - i.sellingCosts) -
          i.workoutCost * i.recoveryDelay,
      ) * recovery[m];
    const terminal = equipCost * i.terminalResale * (1 - i.sellingCosts) * ending[m];
    const siteExit = recovery[m] || ending[m];
    disposalProceeds[m] = forcedProceeds + terminal + (siteExit ? siteProceeds : 0);
    gain[m] = forcedProceeds + terminal - carrying + (siteExit ? siteProceeds - siteCost : 0);
    incomeBefore[m] = ebitda[m] - depreciation[m] + gain[m] - writeOff[m];
  }

  const admin = zeros().map((_, m) => (i.adminPerYear / 12) * (1 + i.adminEscalation) ** Math.floor(m / 12));
  const legal = zeros().map((_, m) => (m === 0 ? i.legalCosts : 0));

  // GPU Financing: loan sizing
  const totalCapex = sum(capex);
  const eligible = sum(equipment) / (1 + i.itShare) * (1 + i.itShare * i.financeIt) + sum(spares) * i.financeSpares;
  const feeGrossUp = 1 - i.originationFee * i.financeFee;
  const requestedLoan = Math.min(eligible * (1 - i.deposit), Math.max(0, totalCapex - totalPrepayment)) / feeGrossUp;

  const perDollarService = zeros();
  let perDollarOpen = 0;
  let perDollarPaid = 0;
  for (let m = 0; m < MONTHS; m++) {
    if (m > 0) perDollarOpen = Math.max(0, perDollarOpen + acq[m - 1] - perDollarPaid);
    const a = age[m];
    perDollarPaid =
      recovery[m] || ending[m] || a >= loanTerm
        ? perDollarOpen
        : a > io
          ? Math.min(perDollarOpen, 1 / (loanTerm - io))
          : 0;
    perDollarService[m] = perDollarPaid + (perDollarOpen * i.interestRate) / 12;
  }
  const sizingCash = zeros().map(
    (_, m) => collections[m] - opex[m] - Math.max(0, incomeBefore[m]) * i.incomeTax - admin[m] - legal[m],
  );

  /** Months of the loan quarter ending at `m`, or null when `m` isn't a quarter end. */
  const quarter = (m: number): [number, number] | null => {
    const a = age[m];
    if (!(a > 0 && a <= loanTerm && (a % 3 === 0 || a === loanTerm))) return null;
    return [ship + 3 * Math.floor((a - 1) / 3) + 1, m + 1];
  };

  let maxDscrLoan = Infinity;
  for (let m = 0; m < MONTHS; m++) {
    const q = quarter(m);
    if (!q) continue;
    const service = sum(perDollarService, ...q);
    if (service > 1e-8) maxDscrLoan = Math.min(maxDscrLoan, Math.max(0, sum(sizingCash, ...q)) / (i.minDscr * service));
  }
  if (maxDscrLoan === Infinity) maxDscrLoan = 0;
  const loan = i.financing ? Math.min(maxDscrLoan, requestedLoan) : 0;
  const dscrFundingGap = i.financing ? Math.max(0, requestedLoan - maxDscrLoan) * feeGrossUp : 0;

  // GPU Financing: debt schedule
  const draws = acq.map((f) => loan * f);
  const fees = draws.map((d) => d * i.originationFee);
  const totalFees = sum(fees);
  const interest = zeros();
  const principal = zeros();
  const feeAmortization = zeros();
  const debtBalance = zeros();
  let debt = 0;
  let unamortized = 0;
  for (let m = 0; m < MONTHS; m++) {
    const a = age[m];
    const open = debt;
    interest[m] = (open * i.interestRate) / 12;
    const scheduledPrincipal = a > io ? Math.min(open, loan / (loanTerm - io)) : 0;
    const exit = recovery[m] || ending[m] || a >= loanTerm ? Math.max(0, open - scheduledPrincipal) : 0;
    principal[m] = scheduledPrincipal + exit;
    debt = Math.max(0, open + draws[m] - principal[m]);
    debtBalance[m] = debt;

    const feeOpen = unamortized;
    feeAmortization[m] =
      open > 0 && debt < 0.01 ? feeOpen : a > 0 ? Math.min(feeOpen, totalFees / loanTerm) : 0;
    unamortized = Math.max(0, feeOpen + fees[m] - feeAmortization[m]);
  }
  const debtService = zeros().map((_, m) => interest[m] + principal[m]);

  const tax = zeros().map(
    (_, m) => Math.max(0, incomeBefore[m] - interest[m] - feeAmortization[m]) * i.incomeTax,
  );
  const taxBenefit = zeros().map((_, m) => Math.max(0, incomeBefore[m]) * i.incomeTax - tax[m]);
  const operatingCash = zeros().map((_, m) => collections[m] - opex[m] - tax[m]);
  const projectCash = zeros().map(
    (_, m) => operatingCash[m] - capex[m] + prepayment[m] + disposalProceeds[m] - refund[m],
  );
  const portfolioCash = zeros().map((_, m) => projectCash[m] + draws[m] - fees[m] - debtService[m]);
  const cashForDebt = zeros().map((_, m) => operatingCash[m] - admin[m] - legal[m]);

  let minQuarterlyDscr: number | null = null;
  let dscrBreaches = 0;
  for (let m = 0; m < MONTHS; m++) {
    const q = quarter(m);
    if (!q) continue;
    const service = sum(interest, ...q) + sum(principal, ...q);
    if (service <= 0.01) continue;
    const dscr = (sum(sizingCash, ...q) + sum(taxBenefit, ...q)) / service;
    minQuarterlyDscr = minQuarterlyDscr === null ? dscr : Math.min(minQuarterlyDscr, dscr);
    if (dscr < i.minDscr - 1e-8) dscrBreaches++;
  }
  let minMonthlyDscr: number | null = null;
  for (let m = 0; m < MONTHS; m++) {
    if (debtService[m] > 0.01) {
      const dscr = cashForDebt[m] / debtService[m];
      minMonthlyDscr = minMonthlyDscr === null ? dscr : Math.min(minMonthlyDscr, dscr);
    }
  }

  // GPU Financing reserve and the Equity waterfall, which share the SPV's cash month to month
  const reserveFactor =
    i.reserveMethod === 1
      ? i.reserveMonths * (1 / (loanTerm - io) + i.interestRate / 12)
      : i.reserveMethod === 2
        ? i.reserveShare
        : 0;
  const committedCash = Math.max(0, totalPrepayment - equipCost * i.deposit);

  const prefContributions = zeros();
  const prefDistributions = zeros();
  const commonDistributions = zeros();
  const prefNet = zeros();
  const cumulativeEquity = zeros();
  const cumulativeDistributions = zeros();
  let reserve = 0;
  let reserveFunded = 0;
  let peakReserveShortfall = 0;
  let cash = 0;
  let prefCapital = 0;
  let unpaidReturn = 0;
  let paidIn = 0;
  let paidOut = 0;
  let allOut = 0;
  for (let m = 0; m < MONTHS; m++) {
    const required = (m < LAST_MONTH ? i.minCash : 0) + (m >= order && m < ship ? committedCash : 0);

    const reserveRequired = debtBalance[m] > 0.01 ? loan * reserveFactor : 0;
    const funded = draws[m] * reserveFactor;
    const used = Math.min(reserve + funded, debtService[m], Math.max(0, debtService[m] - cashForDebt[m]));
    const released = Math.max(0, reserve + funded - used - reserveRequired);
    const afterRelease = reserve + funded - used - released;
    const replenished = Math.min(
      Math.max(0, reserveRequired - afterRelease),
      Math.max(0, cash + portfolioCash[m] - admin[m] - legal[m] - required - funded + used + released),
    );
    reserve = afterRelease + replenished;
    reserveFunded += funded;
    peakReserveShortfall = Math.max(peakReserveShortfall, reserveRequired - reserve);

    const before = cash + portfolioCash[m] + used + released - funded - replenished - admin[m] - legal[m];
    const contribution = Math.max(0, required - before);
    const available = Math.max(0, before + contribution - required);

    const accrued = ((prefCapital + contribution) * i.prefReturn) / 12;
    const returnPaid = Math.min(available, unpaidReturn + accrued);
    const capitalReturned = Math.min(Math.max(0, available - returnPaid), prefCapital + contribution);
    prefCapital += contribution - capitalReturned;
    unpaidReturn += accrued - returnPaid;

    paidIn += contribution;
    const residual = Math.max(0, available - returnPaid - capitalReturned);
    const topUp = Math.min(residual, Math.max(0, paidIn * i.minMoic - paidOut - returnPaid - capitalReturned));
    const toPref = returnPaid + capitalReturned + topUp;
    const toCommon = residual - topUp;
    paidOut += toPref;
    allOut += toPref + toCommon;
    cash = before + contribution - toPref - toCommon;

    prefContributions[m] = contribution;
    prefDistributions[m] = toPref;
    commonDistributions[m] = toCommon;
    prefNet[m] = toPref - contribution;
    cumulativeEquity[m] = paidIn;
    cumulativeDistributions[m] = allOut;
  }

  // Portfolio and Summary
  const spvEbitda = zeros().map((_, m) => ebitda[m] - admin[m] - legal[m]);
  const netProfit = zeros().map(
    (_, m) => spvEbitda[m] - depreciation[m] - tax[m] - interest[m] - feeAmortization[m] + gain[m] - writeOff[m],
  );
  const contractProfit = zeros().map(
    (_, m) =>
      (incomeBefore[m] - tax[m]) * contract[m] -
      (m <= lastContract ? admin[m] + legal[m] : 0) -
      (interest[m] + feeAmortization[m]) * contract[m],
  );

  const year1 = (values: readonly number[]) => sum(values, Math.min(firstOp, MONTHS), Math.min(firstOp + 12, MONTHS));
  const year1Service = year1(debtService);

  const periods: Period[] = [{ label: "Startup", from: 0, to: firstOp }];
  for (let y = 0; y < 6; y++) {
    periods.push({ label: `Year ${y + 1}`, from: firstOp + 12 * y, to: Math.min(MONTHS, firstOp + 12 * (y + 1)) });
  }
  if (firstOp + 72 < MONTHS) periods.push({ label: "Remaining", from: firstOp + 72, to: MONTHS });

  const prefEquity = sum(prefContributions);
  const prefPaid = sum(prefDistributions);
  const equityNet = zeros().map((_, m) => prefNet[m] + commonDistributions[m]);
  const prefEquityAtShipment = sum(prefContributions, 0, firstOp);
  const prefUnrecovered = prefCapital;
  const moicShortfall = Math.max(0, paidIn * i.minMoic - paidOut);

  // Short enough that two or three sit on one line beside the page title.
  const checks: Check[] = [];
  if (ship < i.leadMonths) {
    checks.push({ id: "lead", message: "Ships before the order lead time" });
  }
  if (io >= loanTerm) {
    checks.push({ id: "io", message: "Interest-only period exceeds the term" });
  }
  if (dscrBreaches > 0) {
    checks.push({
      id: "dscr",
      message: `${dscrBreaches} quarter${dscrBreaches === 1 ? "" : "s"} below ${i.minDscr.toFixed(2)}x DSCR`,
    });
  }
  if (prefUnrecovered > 1) {
    checks.push({ id: "capital", message: "Preferred capital not fully returned" });
  }
  if (moicShortfall > 1) {
    checks.push({ id: "moic", message: `Below the ${i.minMoic.toFixed(2)}x minimum MOIC` });
  }
  return {
    gpus,
    itMw,
    facilityMw: itMw * i.pue,
    firstOperatingMonth: firstOp,
    equipmentPurchase: sum(equipment),
    totalCapex,
    contractValue,

    year1Revenue: year1(netRevenue),
    year1Ebitda: year1(spvEbitda),
    year1NetProfit: year1(netProfit),
    year1Lease: year1(leaseCost) / 12,
    year1Electricity: year1(electricity) / 12,
    contractNetProfit: sum(contractProfit),
    lifetimeNetProfit: sum(netProfit),

    prefEquity,
    prefEquityAtShipment,
    prefEquityLater: prefEquity - prefEquityAtShipment,
    prefDistributions: prefPaid,
    prefProfit: prefPaid - prefEquity,
    prefMoic: prefEquity > 0 ? prefPaid / prefEquity : null,
    prefIrr: xirr(prefNet, dates, sum(prefNet) < 0 ? -0.5 : 0.1),
    equityIrr: xirr(equityNet, dates, sum(equityNet) < 0 ? -0.5 : 0.1),
    projectIrr: xirr(projectCash, dates, sum(projectCash) < 0 ? -0.5 : 0.1),
    prefUnrecovered,
    prefReturnUnpaid: unpaidReturn,
    moicShortfall,
    commonDistributions: sum(commonDistributions),
    shareholderProfit: sum(prefNet) + sum(commonDistributions),

    prepayment: sum(prepayment),
    loan: sum(draws),
    requestedLoan,
    maxDscrLoan,
    dscrFundingGap,
    reserveFunded,
    peakReserveShortfall,
    minQuarterlyDscr,
    minMonthlyDscr,
    year1Dscr: year1Service > 0.01 ? year1(cashForDebt) / year1Service : null,
    dscrBreaches,
    debtAtEnd: debtBalance[LAST_MONTH],

    monthly: {
      dates,
      netRevenue,
      ebitda: spvEbitda,
      netProfit,
      capex,
      debtBalance,
      debtService,
      netBookValue,
      prefContributions,
      prefDistributions,
      commonDistributions,
      cumulativeEquity,
      cumulativeDistributions,
      leaseCost,
      electricity,
    },
    periods,
    checks,
  };
}

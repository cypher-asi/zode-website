/**
 * Inputs to the GPU SPV model, with defaults taken from the Assumptions sheet
 * of ZODE_GPU_SPV_Model.xlsm. Rates and shares are fractions (0.18 is 18%).
 */

export type ScenarioId = "base" | "downside" | "severe";

/** The cases the workbook switches between; each sets the rows below. */
export interface Scenario {
  label: string;
  /** Merchant $/GPU-hour in post-contract years 1 to 5; the last rate continues. */
  merchantPrices: readonly number[];
  /** Merchant paid utilization in post-contract years 1 to 5. */
  merchantUtilization: readonly number[];
  /** Forced-sale recovery after hardware value decline, by year of age 1 to 5. */
  recovery: readonly number[];
  /** Terminal resale as a share of original node and IT cost. */
  terminalResale: number;
  /** Operating month of a forced sale; 0 for none. */
  forcedSaleMonth: number;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  base: {
    label: "Base",
    merchantPrices: [3.5, 3, 2.5, 2, 1.5],
    merchantUtilization: [0.85, 0.85, 0.85, 0.8, 0.75],
    recovery: [0.7, 0.7, 0.7, 0.7, 0.7],
    terminalResale: 0.1,
    forcedSaleMonth: 0,
  },
  downside: {
    label: "Downside",
    merchantPrices: [2.25, 2, 1.75, 1.5, 1.25],
    merchantUtilization: [0.65, 0.65, 0.6, 0.55, 0.5],
    recovery: [0.5, 0.5, 0.5, 0.5, 0.5],
    terminalResale: 0.05,
    forcedSaleMonth: 24,
  },
  severe: {
    label: "Severe",
    merchantPrices: [1.25, 1, 0.75, 0.5, 0.25],
    merchantUtilization: [0.5, 0.45, 0.4, 0.35, 0.3],
    recovery: [0.3, 0.3, 0.3, 0.3, 0.3],
    terminalResale: 0,
    forcedSaleMonth: 18,
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

/** Contract price by contract year, relative to year 1; the final entry continues. */
export const CONTRACT_CURVE = [1, 1, 1, 1, 1, 0.9, 0.9] as const;

export const GPUS_PER_NODE = 8;
/** Months of operation forecast after each shipment. */
export const OPERATING_MONTHS = 72;
/** Index of the last forecast month; the workbook runs months 0 to 84. */
export const LAST_MONTH = 84;

export interface ModelInputs {
  scenario: ScenarioId;

  // Cluster and equipment
  nodes: number;
  nodeCost: number;
  itShare: number;
  spareShare: number;
  setupCost: number;
  kwPerNode: number;
  leadMonths: number;
  shipMonth: number;
  depreciationMonths: number;
  bookResidual: number;

  // Customer contract and merchant sales
  contractPrice: number;
  contractMonths: number;
  contractedShare: number;
  prepaymentShare: number;
  slaCredits: number;
  receivableDays: number;
  merchantPrices: number[];
  merchantUtilization: number[];
  merchantPriceFactor: number;
  utilizationFactor: number;
  marketplaceFee: number;
  rampMonth1: number;
  rampMonth2: number;

  // Facility
  /** 0 leases the site, 1 buys it. */
  siteMode: number;
  baseLease: number;
  /** Escalates base rent only; NNN and operations follow `fixedEscalation`. */
  leaseEscalation: number;
  /**
   * A leased site: the tenant's capital contribution to the landlord's build-out,
   * per MW of critical IT load. Equity-funded capex at the forecast start, never recovered.
   */
  leaseContributionPerMw: number;
  nnn: number;
  operations: number;
  pue: number;
  electricityRate: number;
  electricityEscalation: number;
  idleLoad: number;
  fixedEscalation: number;
  /**
   * A purchased site: price, closing costs and conversion are capex at the forecast start,
   * never depreciated, part funded by a bank loan and the rest by equity.
   */
  sitePurchase: number;
  /** Share of the purchase price. */
  siteClosingCosts: number;
  /** Per MW of critical IT load. */
  siteConversionPerMw: number;
  /** Bank loan / purchase price plus conversion. */
  siteLtv: number;
  siteRate: number;
  siteAmortizationYears: number;
  /** Bank origination fee / site loan, expensed at the forecast start. */
  siteLoanFee: number;
  /** Placement fee / site equity raised, expensed at the forecast start. */
  siteEquityFee: number;
  /** Share of the site purchase price recovered when the deployment ends. */
  siteResidual: number;

  // Cluster operating costs
  managementFee: number;
  insuranceRate: number;
  supportRate: number;
  internet: number;
  remoteHands: number;
  software: number;
  overhead: number;
  otherInsurance: number;
  contingency: number;

  // SPV costs and cash reserve
  minCash: number;
  adminPerYear: number;
  legalCosts: number;
  adminEscalation: number;

  // Preferred equity
  prefReturn: number;
  minMoic: number;

  // Taxes
  purchaseTax: number;
  taxExempt: number;
  importTax: number;
  incomeTax: number;

  // GPU financing (flags are 1 or 0)
  financing: number;
  deposit: number;
  financeIt: number;
  financeSpares: number;
  interestRate: number;
  loanMonths: number;
  interestOnlyMonths: number;
  originationFee: number;
  financeFee: number;
  minDscr: number;
  /** 0 off, 1 months of peak debt service, 2 share of the loan. */
  reserveMethod: number;
  reserveMonths: number;
  reserveShare: number;

  // Asset recovery
  hardwareDecline: number;
  recoveryDelay: number;
  sellingCosts: number;
  workoutCost: number;
  recovery: number[];
  terminalResale: number;
  forcedSaleMonth: number;
}

export type NumericKey = {
  [K in keyof ModelInputs]: ModelInputs[K] extends number ? K : never;
}[keyof ModelInputs];

/** Sets every input a scenario controls. */
export function withScenario(inputs: ModelInputs, id: ScenarioId): ModelInputs {
  const s = SCENARIOS[id];
  return {
    ...inputs,
    scenario: id,
    merchantPrices: [...s.merchantPrices],
    merchantUtilization: [...s.merchantUtilization],
    recovery: [...s.recovery],
    terminalResale: s.terminalResale,
    forcedSaleMonth: s.forcedSaleMonth,
  };
}

export const DEFAULT_INPUTS: ModelInputs = withScenario(
  {
    scenario: "base",

    nodes: 256,
    nodeCost: 550_000,
    itShare: 0.16,
    spareShare: 0.01,
    setupCost: 250_000,
    kwPerNode: 15.625,
    leadMonths: 3,
    shipMonth: 3,
    depreciationMonths: 60,
    bookResidual: 0,

    contractPrice: 5,
    contractMonths: 48,
    contractedShare: 1,
    prepaymentShare: 0.3,
    slaCredits: 0.01,
    receivableDays: 15,
    merchantPrices: [],
    merchantUtilization: [],
    merchantPriceFactor: 1,
    utilizationFactor: 1,
    marketplaceFee: 0.1,
    rampMonth1: 0.5,
    rampMonth2: 0.75,

    siteMode: 0,
    baseLease: 170,
    leaseEscalation: 0.025,
    leaseContributionPerMw: 0,
    nnn: 20,
    operations: 36,
    pue: 1.3,
    electricityRate: 0.102,
    electricityEscalation: 0.03,
    idleLoad: 0.6,
    fixedEscalation: 0.03,
    sitePurchase: 10_000_000,
    siteClosingCosts: 0.02,
    siteConversionPerMw: 8_000_000,
    siteLtv: 0.6,
    siteRate: 0.075,
    siteAmortizationYears: 25,
    siteLoanFee: 0.01,
    siteEquityFee: 0.02,
    siteResidual: 1,

    managementFee: 0.02,
    insuranceRate: 0.005,
    supportRate: 0.02,
    internet: 0,
    remoteHands: 0,
    software: 20_000,
    overhead: 15_000,
    otherInsurance: 100_000,
    contingency: 0.03,

    minCash: 1_000_000,
    adminPerYear: 500_000,
    legalCosts: 150_000,
    adminEscalation: 0.03,

    prefReturn: 0.18,
    minMoic: 1.5,

    purchaseTax: 0.0725,
    taxExempt: 0,
    importTax: 0,
    incomeTax: 0,

    financing: 1,
    deposit: 0.2,
    financeIt: 1,
    financeSpares: 0,
    interestRate: 0.12,
    loanMonths: 36,
    interestOnlyMonths: 0,
    originationFee: 0,
    financeFee: 0,
    minDscr: 1.15,
    reserveMethod: 2,
    reserveMonths: 3,
    reserveShare: 0.1,

    hardwareDecline: 0.3,
    recoveryDelay: 6,
    sellingCosts: 0.1,
    workoutCost: 25_000,
    recovery: [],
    terminalResale: 0,
    forcedSaleMonth: 0,
  },
  "base",
);

export type Format =
  | "usd"
  | "pct"
  | "x"
  | "months"
  | "years"
  | "count"
  | "gpuHour"
  | "kwh"
  | "kw"
  | "kwMonth"
  | "usdPerMw"
  | "days";

interface FieldBase {
  key: NumericKey;
  label: string;
  note?: string;
  /** Hidden when this returns false. */
  visible?: (inputs: ModelInputs) => boolean;
}

export type FieldDef = FieldBase &
  (
    | {
        kind: "range";
        format: Format;
        min: number | ((inputs: ModelInputs) => number);
        max: number | ((inputs: ModelInputs) => number);
        step: number;
      }
    | { kind: "toggle" }
    | { kind: "choice"; options: readonly { value: number; label: string }[] }
  );

export type SectionId = "cluster" | "revenue" | "facility" | "operations" | "financing" | "equity";

export interface SectionDef {
  id: SectionId;
  title: string;
  /** One short word, so six step tabs fit across the panel. */
  tab: string;
  fields: readonly FieldDef[];
}

const financed = (i: ModelInputs) => i.financing === 1;
const leased = (i: ModelInputs) => i.siteMode === 0;
const purchased = (i: ModelInputs) => i.siteMode === 1;
const siteFinanced = (i: ModelInputs) => purchased(i) && i.siteLtv > 0;

export const SECTIONS: readonly SectionDef[] = [
  {
    id: "cluster",
    title: "Cluster",
    tab: "Cluster",
    fields: [
      { key: "nodes", label: "B300 nodes", kind: "range", format: "count", min: 8, max: 2048, step: 8 },
      {
        key: "nodeCost",
        label: "Node cost, excluding IT",
        kind: "range",
        format: "usd",
        min: 300_000,
        max: 800_000,
        step: 5_000,
      },
      { key: "itShare", label: "IT cost / node cost", kind: "range", format: "pct", min: 0, max: 0.3, step: 0.01 },
      {
        key: "spareShare",
        label: "Spare equipment",
        note: "Non-revenue-generating spares, included in the depreciable asset pool.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.05,
        step: 0.005,
      },
      {
        key: "setupCost",
        label: "Capitalized deployment and setup",
        kind: "range",
        format: "usd",
        min: 0,
        max: 2_000_000,
        step: 50_000,
      },
      {
        key: "kwPerNode",
        label: "Critical IT load per node",
        kind: "range",
        format: "kw",
        min: 10,
        max: 25,
        step: 0.125,
      },
      {
        key: "leadMonths",
        label: "Order to shipment lead",
        note: "Customer prepayment and the equipment deposit occur at order.",
        kind: "range",
        format: "months",
        min: 0,
        max: 6,
        step: 1,
      },
      {
        key: "shipMonth",
        label: "Shipment month",
        note: "Months after the forecast start. Operations begin the month after.",
        kind: "range",
        format: "months",
        min: (i) => i.leadMonths,
        max: 11,
        step: 1,
      },
      {
        key: "depreciationMonths",
        label: "Depreciation life",
        kind: "range",
        format: "months",
        min: 24,
        max: 84,
        step: 6,
      },
    ],
  },
  {
    id: "revenue",
    title: "Revenue",
    tab: "Sales",
    fields: [
      {
        key: "contractPrice",
        label: "Contract price / GPU-hour",
        note: "Year 1 rate. Years 6 and later step down 10%.",
        kind: "range",
        format: "gpuHour",
        min: 1,
        max: 10,
        step: 0.05,
      },
      {
        key: "contractMonths",
        label: "Customer contract term",
        kind: "range",
        format: "months",
        min: 12,
        max: 72,
        step: 6,
      },
      {
        key: "contractedShare",
        label: "Contracted share of capacity",
        note: "Uncontracted capacity is sold at merchant rates.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "prepaymentShare",
        label: "Customer prepayment / contract value",
        note: "Collected at order and credited against monthly contract billings.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.6,
        step: 0.05,
      },
      { key: "slaCredits", label: "SLA credits", kind: "range", format: "pct", min: 0, max: 0.05, step: 0.005 },
      { key: "receivableDays", label: "Receivable days", kind: "range", format: "days", min: 0, max: 60, step: 5 },
      {
        key: "merchantPriceFactor",
        label: "Merchant price multiplier",
        note: "Scales the scenario's post-contract price curve.",
        kind: "range",
        format: "x",
        min: 0.5,
        max: 1.5,
        step: 0.05,
      },
      {
        key: "utilizationFactor",
        label: "Merchant utilization multiplier",
        kind: "range",
        format: "x",
        min: 0.5,
        max: 1.2,
        step: 0.05,
      },
      {
        key: "marketplaceFee",
        label: "Marketplace fee / merchant revenue",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.25,
        step: 0.01,
      },
    ],
  },
  {
    id: "facility",
    title: "Facility",
    tab: "Site",
    fields: [
      {
        key: "siteMode",
        label: "Site",
        kind: "choice",
        options: [
          { value: 0, label: "Lease" },
          { value: 1, label: "Purchase" },
        ],
      },
      {
        key: "baseLease",
        label: "Base lease / critical kW-month",
        kind: "range",
        format: "kwMonth",
        min: 80,
        max: 300,
        step: 5,
        visible: leased,
      },
      {
        key: "leaseEscalation",
        label: "Annual lease escalation",
        note: "Applies to base rent from operating year 2.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.06,
        step: 0.0025,
        visible: leased,
      },
      {
        key: "leaseContributionPerMw",
        label: "Tenant capital contribution / critical MW",
        note: "Paid to the landlord toward the build-out at the forecast start; not recovered at exit.",
        kind: "range",
        format: "usdPerMw",
        min: 0,
        max: 5_000_000,
        step: 50_000,
        visible: leased,
      },
      {
        key: "sitePurchase",
        label: "Site purchase price",
        kind: "range",
        format: "usd",
        min: 0,
        max: 100_000_000,
        step: 250_000,
        visible: purchased,
      },
      {
        key: "siteClosingCosts",
        label: "Closing costs / purchase price",
        note: "Title, legal, transfer taxes and diligence.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.06,
        step: 0.0025,
        visible: purchased,
      },
      {
        key: "siteConversionPerMw",
        label: "Conversion cost / critical MW",
        note: "Power, cooling and fit-out to make the building ready for the cluster.",
        kind: "range",
        format: "usdPerMw",
        min: 0,
        max: 20_000_000,
        step: 250_000,
        visible: purchased,
      },
      {
        key: "siteLtv",
        label: "Bank loan / purchase and conversion",
        note: "Equity funds the rest, closing costs and fees.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.8,
        step: 0.05,
        visible: purchased,
      },
      {
        key: "siteRate",
        label: "Bank loan interest rate",
        kind: "range",
        format: "pct",
        min: 0.03,
        max: 0.14,
        step: 0.0025,
        visible: siteFinanced,
      },
      {
        key: "siteAmortizationYears",
        label: "Bank loan amortization",
        note: "Level monthly payments; the balance is repaid when the site is sold.",
        kind: "range",
        format: "years",
        min: 5,
        max: 30,
        step: 1,
        visible: siteFinanced,
      },
      {
        key: "siteLoanFee",
        label: "Bank origination fee / loan",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.03,
        step: 0.0025,
        visible: siteFinanced,
      },
      {
        key: "siteEquityFee",
        label: "Equity placement fee / site equity",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.08,
        step: 0.0025,
        visible: purchased,
      },
      {
        key: "siteResidual",
        label: "Site value recovered at exit",
        note: "Share of the purchase price; conversion spend isn't recovered.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 1.5,
        step: 0.05,
        visible: purchased,
      },
      {
        key: "nnn",
        label: "NNN / critical kW-month",
        note: "Property taxes, building insurance and maintenance, paid directly on an owned site.",
        kind: "range",
        format: "kwMonth",
        min: 0,
        max: 60,
        step: 1,
      },
      {
        key: "operations",
        label: "Tier 3 operations / critical kW-month",
        kind: "range",
        format: "kwMonth",
        min: 0,
        max: 80,
        step: 1,
      },
      { key: "pue", label: "PUE", kind: "range", format: "x", min: 1.05, max: 1.6, step: 0.01 },
      {
        key: "electricityRate",
        label: "Delivered electricity / kWh",
        kind: "range",
        format: "kwh",
        min: 0.03,
        max: 0.2,
        step: 0.002,
      },
      {
        key: "electricityEscalation",
        label: "Annual electricity escalation",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.08,
        step: 0.005,
      },
      {
        key: "fixedEscalation",
        label: "Annual fixed-cost escalation",
        note: "NNN, operations, insurance and other fixed costs.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.08,
        step: 0.005,
      },
      {
        key: "idleLoad",
        label: "Idle power / full load",
        note: "Load factor is the idle floor plus the occupied-capacity variable load.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    tab: "Opex",
    fields: [
      {
        key: "managementFee",
        label: "Cluster management / net revenue",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.1,
        step: 0.005,
      },
      {
        key: "supportRate",
        label: "Hardware support / asset cost / year",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.05,
        step: 0.0025,
      },
      {
        key: "insuranceRate",
        label: "Equipment insurance / asset cost / year",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.02,
        step: 0.001,
      },
      {
        key: "software",
        label: "Software and security / month",
        kind: "range",
        format: "usd",
        min: 0,
        max: 100_000,
        step: 1_000,
      },
      { key: "overhead", label: "Overhead / month", kind: "range", format: "usd", min: 0, max: 100_000, step: 1_000 },
      {
        key: "otherInsurance",
        label: "Other insurance / year",
        kind: "range",
        format: "usd",
        min: 0,
        max: 500_000,
        step: 10_000,
      },
      {
        key: "contingency",
        label: "Operating contingency",
        note: "Applies to facility and other operating costs, before management fees.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.1,
        step: 0.005,
      },
      {
        key: "adminPerYear",
        label: "SPV administration / year",
        kind: "range",
        format: "usd",
        min: 0,
        max: 2_000_000,
        step: 25_000,
      },
      {
        key: "legalCosts",
        label: "Upfront legal costs",
        kind: "range",
        format: "usd",
        min: 0,
        max: 1_000_000,
        step: 25_000,
      },
      {
        key: "minCash",
        label: "Minimum operating cash reserve",
        note: "Retained until the final modeled month.",
        kind: "range",
        format: "usd",
        min: 0,
        max: 5_000_000,
        step: 100_000,
      },
    ],
  },
  {
    id: "financing",
    title: "Financing",
    tab: "Debt",
    fields: [
      { key: "financing", label: "GPU loan", kind: "toggle" },
      {
        key: "deposit",
        label: "Equipment deposit",
        note: "Vendor order deposit; the customer prepayment can fund it.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.5,
        step: 0.05,
      },
      { key: "financeIt", label: "Include IT in financing", kind: "toggle", visible: financed },
      { key: "financeSpares", label: "Include spares in financing", kind: "toggle", visible: financed },
      {
        key: "interestRate",
        label: "Annual loan interest rate",
        kind: "range",
        format: "pct",
        min: 0.04,
        max: 0.2,
        step: 0.0025,
        visible: financed,
      },
      {
        key: "loanMonths",
        label: "Loan term",
        note: "Equal principal after the interest-only period.",
        kind: "range",
        format: "months",
        min: 12,
        max: 60,
        step: 6,
        visible: financed,
      },
      {
        key: "interestOnlyMonths",
        label: "Interest-only period",
        kind: "range",
        format: "months",
        min: 0,
        max: 11,
        step: 1,
        visible: financed,
      },
      {
        key: "originationFee",
        label: "Origination fee / gross loan",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.05,
        step: 0.0025,
        visible: financed,
      },
      {
        key: "minDscr",
        label: "Minimum quarterly DSCR",
        note: "Caps the loan so every operating quarter covers debt service.",
        kind: "range",
        format: "x",
        min: 1,
        max: 2,
        step: 0.05,
        visible: financed,
      },
      {
        key: "reserveMethod",
        label: "Debt service reserve",
        kind: "choice",
        options: [
          { value: 0, label: "Off" },
          { value: 1, label: "Months" },
          { value: 2, label: "% of loan" },
        ],
        visible: financed,
      },
      {
        key: "reserveMonths",
        label: "Reserve months of peak debt service",
        kind: "range",
        format: "months",
        min: 0,
        max: 6,
        step: 1,
        visible: (i) => financed(i) && i.reserveMethod === 1,
      },
      {
        key: "reserveShare",
        label: "Reserve / gross loan",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.25,
        step: 0.01,
        visible: (i) => financed(i) && i.reserveMethod === 2,
      },
    ],
  },
  {
    id: "equity",
    title: "Equity & exit",
    tab: "Exit",
    fields: [
      {
        key: "prefReturn",
        label: "Annual preferred return",
        note: "Simple cumulative accrual on unreturned capital.",
        kind: "range",
        format: "pct",
        min: 0.06,
        max: 0.3,
        step: 0.005,
      },
      {
        key: "minMoic",
        label: "Minimum investor MOIC",
        note: "Capital and preferred payments count toward the minimum payout.",
        kind: "range",
        format: "x",
        min: 1,
        max: 3,
        step: 0.05,
      },
      {
        key: "incomeTax",
        label: "Project income tax rate",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.35,
        step: 0.01,
      },
      {
        key: "purchaseTax",
        label: "Purchase tax rate",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.12,
        step: 0.0025,
      },
      {
        key: "taxExempt",
        label: "Exempt share of purchases",
        kind: "range",
        format: "pct",
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "importTax",
        label: "Import tax / equipment",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.2,
        step: 0.01,
      },
      {
        key: "hardwareDecline",
        label: "Annual hardware value decline",
        note: "Used only for forced-sale proceeds, not depreciation.",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.5,
        step: 0.05,
      },
      {
        key: "sellingCosts",
        label: "Selling costs / proceeds",
        kind: "range",
        format: "pct",
        min: 0,
        max: 0.25,
        step: 0.01,
      },
      {
        key: "forcedSaleMonth",
        label: "Forced-sale month",
        note: "Operating month the equipment is sold early; 0 for none. Set by the scenario.",
        kind: "range",
        format: "months",
        min: 0,
        max: 72,
        step: 1,
      },
      {
        key: "recoveryDelay",
        label: "Forced-sale recovery delay",
        kind: "range",
        format: "months",
        min: 0,
        max: 12,
        step: 1,
      },
    ],
  },
];

/** Evaluates a field bound that may depend on other inputs. */
export const bound = (value: number | ((inputs: ModelInputs) => number), inputs: ModelInputs) =>
  typeof value === "function" ? value(inputs) : value;

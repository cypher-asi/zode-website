import "server-only";
import type { RampQuarter } from "./slides";

/**
 * Written by scripts/write-revenue-ramp.mjs from 02 MODEL/ZODE_MasterModel_26.11.09_v2.xlsx in ZODE ASCENT:
 * the consolidated monthly P&L on its Zode Inc. tab, by quarter to Dec 2030.
 * Whole USD; costs are positive. Rerun the script with each new model.
 */
export const REVENUE_RAMP: { readonly model: string; readonly quarters: readonly RampQuarter[] } = {
  model: "ZODE_MasterModel_26.11.09_v2.xlsx",
  quarters: [
    {
      quarter: "Q4 2026",
      revenue: { inference: 0, merchant: 0, offtake: 0 },
      costs: { opCosts: 0, power: 0, debtService: 0, topco: 0 },
    },
    {
      quarter: "Q1 2027",
      revenue: { inference: 0, merchant: 0, offtake: 0 },
      costs: { opCosts: 412500, power: 0, debtService: 200000, topco: 501125 },
    },
    {
      quarter: "Q2 2027",
      revenue: { inference: 51164006, merchant: 4843930, offtake: 42048000 },
      costs: { opCosts: 13517257, power: 1998594, debtService: 11897268, topco: 1251617 },
    },
    {
      quarter: "Q3 2027",
      revenue: { inference: 260883137, merchant: 51315379, offtake: 168192000 },
      costs: { opCosts: 61258182, power: 10112544, debtService: 55223026, topco: 1898281 },
    },
    {
      quarter: "Q4 2027",
      revenue: { inference: 511506824, merchant: 121022554, offtake: 294336000 },
      costs: { opCosts: 115812099, power: 19593054, debtService: 125745251, topco: 2791231 },
    },
    {
      quarter: "Q1 2028",
      revenue: { inference: 734860807, merchant: 175239245, offtake: 420480000 },
      costs: { opCosts: 167727929, power: 29007400, debtService: 192719648, topco: 5236160 },
    },
    {
      quarter: "Q2 2028",
      revenue: { inference: 859355448, merchant: 178143080, offtake: 546624000 },
      costs: { opCosts: 202826116, power: 34784247, debtService: 237103811, topco: 5743245 },
    },
    {
      quarter: "Q3 2028",
      revenue: { inference: 945321638, merchant: 168848790, offtake: 672768000 },
      costs: { opCosts: 233980451, power: 40326502, debtService: 274037916, topco: 6148877 },
    },
    {
      quarter: "Q4 2028",
      revenue: { inference: 1023106917, merchant: 154907355, offtake: 798912000 },
      costs: { opCosts: 264163727, power: 45868757, debtService: 310051863, topco: 6528853 },
    },
    {
      quarter: "Q1 2029",
      revenue: { inference: 1106346136, merchant: 144064017, offtake: 925056000 },
      costs: { opCosts: 299091793, power: 52953342, debtService: 348196649, topco: 9323901 },
    },
    {
      quarter: "Q2 2029",
      revenue: { inference: 1199124422, merchant: 142514464, offtake: 1051200000 },
      costs: { opCosts: 332020648, power: 58661865, debtService: 386468786, topco: 9758647 },
    },
    {
      quarter: "Q3 2029",
      revenue: { inference: 3399730974, merchant: 1346061432, offtake: 1177344000 },
      costs: { opCosts: 731559611, power: 118737269, debtService: 753469733, topco: 16819242 },
    },
    {
      quarter: "Q4 2029",
      revenue: { inference: 3461959197, merchant: 1334908284, offtake: 1303488000 },
      costs: { opCosts: 761629510, power: 124445792, debtService: 942217699, topco: 17173680 },
    },
    {
      quarter: "Q1 2030",
      revenue: { inference: 3528550573, merchant: 1326233613, offtake: 1429632000 },
      costs: { opCosts: 801681737, power: 134058943, debtService: 964969356, topco: 19398376 },
    },
    {
      quarter: "Q2 2030",
      revenue: { inference: 3602773202, merchant: 1324993971, offtake: 1555776000 },
      costs: { opCosts: 834070441, power: 139938722, debtService: 989350855, topco: 19796630 },
    },
    {
      quarter: "Q3 2030",
      revenue: { inference: 5789625164, merchant: 2530028025, offtake: 1681920000 },
      costs: { opCosts: 1270773403, power: 213015965, debtService: 1408390959, topco: 26832690 },
    },
    {
      quarter: "Q4 2030",
      revenue: { inference: 5839407742, merchant: 2521105507, offtake: 1808064000 },
      costs: { opCosts: 1300874943, power: 218895744, debtService: 1613711516, topco: 27166698 },
    },
  ],
};

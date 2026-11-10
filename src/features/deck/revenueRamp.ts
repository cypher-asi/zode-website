import "server-only";
import type { RampQuarter } from "./slides";

/**
 * Written by scripts/write-revenue-ramp.mjs from 02 MODEL/ZODE_MasterModel_26.11.09.xlsx in ZODE ASCENT:
 * the consolidated monthly P&L on its Zode Inc. tab, by quarter to Dec 2030.
 * Whole USD; costs are positive. Rerun the script with each new model.
 */
export const REVENUE_RAMP: { readonly model: string; readonly quarters: readonly RampQuarter[] } = {
  model: "ZODE_MasterModel_26.11.09.xlsx",
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
      revenue: { inference: 218246465, merchant: 51315379, offtake: 126144000 },
      costs: { opCosts: 49886535, power: 8318934, debtService: 55223026, topco: 1728912 },
    },
    {
      quarter: "Q4 2027",
      revenue: { inference: 340960136, merchant: 121022554, offtake: 126144000 },
      costs: { opCosts: 70325513, power: 12418614, debtService: 83445890, topco: 2113753 },
    },
    {
      quarter: "Q1 2028",
      revenue: { inference: 436404103, merchant: 175239245, offtake: 126144000 },
      costs: { opCosts: 86921397, power: 16075472, debtService: 109041085, topco: 4050575 },
    },
    {
      quarter: "Q2 2028",
      revenue: { inference: 432988728, merchant: 178143080, offtake: 126144000 },
      costs: { opCosts: 87388213, power: 16310064, debtService: 112966202, topco: 4049552 },
    },
    {
      quarter: "Q3 2028",
      revenue: { inference: 399572236, merchant: 168848790, offtake: 126144000 },
      costs: { opCosts: 84422816, power: 16310064, debtService: 110361419, topco: 3964130 },
    },
    {
      quarter: "Q4 2028",
      revenue: { inference: 375029502, merchant: 154907355, offtake: 126144000 },
      costs: { opCosts: 81509641, power: 16310064, debtService: 107756636, topco: 3887162 },
    },
    {
      quarter: "Q1 2029",
      revenue: { inference: 355940709, merchant: 144064017, offtake: 126144000 },
      costs: { opCosts: 79972406, power: 16799366, debtService: 108202848, topco: 6225266 },
    },
    {
      quarter: "Q2 2029",
      revenue: { inference: 346390982, merchant: 142514464, offtake: 126144000 },
      costs: { opCosts: 79272887, power: 16799366, debtService: 109696569, topco: 6203068 },
    },
    {
      quarter: "Q3 2029",
      revenue: { inference: 2451491389, merchant: 1346061432, offtake: 126144000 },
      costs: { opCosts: 445592787, power: 71166248, debtService: 440839258, topco: 12820362 },
    },
    {
      quarter: "Q4 2029",
      revenue: { inference: 2431857202, merchant: 1334908284, offtake: 126144000 },
      costs: { opCosts: 443262248, power: 71166248, debtService: 594649124, topco: 12758788 },
    },
    {
      quarter: "Q1 2030",
      revenue: { inference: 2416586167, merchant: 1326233613, offtake: 126144000 },
      costs: { opCosts: 445252593, power: 73301235, debtService: 580982837, topco: 14567471 },
    },
    {
      quarter: "Q2 2030",
      revenue: { inference: 2408946386, merchant: 1324993971, offtake: 126144000 },
      costs: { opCosts: 444692978, power: 73301235, debtService: 567316551, topco: 14549712 },
    },
    {
      quarter: "Q3 2030",
      revenue: { inference: 1961193111, merchant: 1076849145, offtake: 126144000 },
      costs: { opCosts: 402681332, power: 73301235, debtService: 553650265, topco: 13157916 },
    },
    {
      quarter: "Q4 2030",
      revenue: { inference: 1945485761, merchant: 1067926627, offtake: 126144000 },
      costs: { opCosts: 400816900, power: 73301235, debtService: 539983978, topco: 13108657 },
    },
  ],
};

import { DEFAULT_INPUTS, SCENARIOS, SECTIONS, withScenario, type ModelInputs, type NumericKey, type ScenarioId } from "./inputs";

/** Every input a slider, switch or choice can change; the rest follow the scenario. */
const EDITABLE: readonly NumericKey[] = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

/** The defaults for a scenario: the workbook's inputs with that case's rows. */
export const defaultsFor = (scenario: ScenarioId) => withScenario(DEFAULT_INPUTS, scenario);

/** Reads inputs from query params; anything missing or unreadable keeps its default. */
export function inputsFromParams(params: URLSearchParams): ModelInputs {
  const raw = params.get("scenario");
  const scenario = raw && raw in SCENARIOS ? (raw as ScenarioId) : "base";
  const inputs = { ...defaultsFor(scenario) };
  for (const key of EDITABLE) {
    const value = params.get(key);
    const n = value === null ? NaN : Number(value);
    if (Number.isFinite(n)) inputs[key] = n;
  }
  return inputs;
}

/** Writes only what differs from the scenario's defaults onto `params`. */
export function writeInputParams(inputs: ModelInputs, params: URLSearchParams): void {
  const defaults = defaultsFor(inputs.scenario);
  if (inputs.scenario === "base") params.delete("scenario");
  else params.set("scenario", inputs.scenario);
  for (const key of EDITABLE) {
    if (inputs[key] === defaults[key]) params.delete(key);
    else params.set(key, String(Number(inputs[key].toPrecision(10))));
  }
}

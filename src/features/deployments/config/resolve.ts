import type { Deployment, Phase } from "../types";
import {
  CONFIG_FIELDS,
  SYSTEMS,
  configField,
  valueLabel,
  type ConfigField,
  type ConfigKey,
  type ConfigOverrides,
  type ResolvedConfig,
} from "./catalog";

export type ConfigSource = Pick<Deployment, "platform" | "cooling" | "networking" | "storageTbPerNode" | "configuration">;

/**
 * The configuration phase `phase` is built to: the deployment's, with what
 * the phase overrides, on the phase's platform. With no phase, the
 * deployment's own on its platform. Rack-scale systems are liquid-cooled
 * whatever's set.
 */
export function resolveConfig(
  d: ConfigSource,
  phase?: Pick<Phase, "platform" | "configOverrides"> | null,
): ResolvedConfig {
  const platform = phase?.platform ?? d.platform;
  const c: ResolvedConfig = {
    ...d.configuration,
    cooling: d.cooling,
    networking: d.networking,
    storageTbPerNode: d.storageTbPerNode,
    ...phase?.configOverrides,
    platform,
  };
  if (SYSTEMS[platform].rackScale) c.cooling = "liquid_dtc";
  return c;
}

/** The fields that apply to configuration `c`, in catalog order. */
export const fieldsFor = (c: ResolvedConfig): ConfigField[] => CONFIG_FIELDS.filter((f) => !f.applies || f.applies(c));

/** Each override that applies to the phase's configuration `c`, as "Label: value". */
export function overrideLabels(overrides: ConfigOverrides, c: ResolvedConfig): string[] {
  const applied = new Set(fieldsFor(c).map((f) => f.key));
  return (Object.keys(overrides) as ConfigKey[])
    .filter((key) => applied.has(key))
    .map((key) => `${configField(key).label}: ${valueLabel(key, overrides[key])}`);
}

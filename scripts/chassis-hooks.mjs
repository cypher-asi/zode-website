/**
 * Lets Node import the Chassis app's model from scripts: its TypeScript
 * imports omit the extension and use the `@/` alias, as the bundler allows,
 * and the seed design's JSON is imported without an import attribute.
 */
import { registerHooks } from "node:module";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    try {
      return next(target, context);
    } catch (error) {
      if (/^(\.|file:)/.test(target) && !/\.([cm]?[jt]s|json)$/.test(target)) return next(`${target}.ts`, context);
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith(".json")) return next(url, { ...context, importAttributes: { type: "json" } });
    return next(url, context);
  },
});

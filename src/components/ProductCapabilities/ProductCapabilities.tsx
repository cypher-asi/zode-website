import type { ReactElement } from "react";
import styles from "./ProductCapabilities.module.css";

interface Capability {
  readonly title: string;
  readonly description: string;
}

const CAPABILITIES: readonly Capability[] = [
  {
    title: "Use existing energy",
    description:
      "ZODE One taps the power you already have. Run on grid, solar, or on-site generation and scale draw to match your load, with no new substation required.",
  },
  {
    title: "Deploy fast",
    description:
      "Pre-integrated modules arrive ready to run. Site, connect, and bring compute online in days instead of the months a traditional build demands.",
  },
  {
    title: "Respect the planet",
    description:
      "Liquid cooling and renewable-first power keep efficiency high and emissions low, so every rack you add stays light on the land around it.",
  },
];

/**
 * Showcase band shown above the specs section: a full-width rounded image with
 * a left-aligned header and copy, followed by three titled subsections
 * (Use existing energy / Deploy fast / Respect the planet).
 */
export function ProductCapabilities(): ReactElement {
  return (
    <section className={styles.capabilities} aria-label="Modular, elastic, and sustainable by design">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.image}
        src="/images/product-capabilities.png"
        alt="ZODE One units lit from within at dusk, set against a mountain hillside."
      />
      <div className={styles.intro}>
        <h2 className={styles.header}>Compute that grows with you.</h2>
        <p className={styles.description}>
          Every ZODE One site starts as a single rack and scales on demand. Drop
          in modules as your workloads grow, draw exactly the power you need, and
          run it all on renewable energy, without rebuilding from scratch.
        </p>
      </div>
      <div className={styles.row}>
        {CAPABILITIES.map((capability) => (
          <div key={capability.title} className={styles.item}>
            <h3 className={styles.itemTitle}>{capability.title}</h3>
            <p className={styles.itemDescription}>{capability.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

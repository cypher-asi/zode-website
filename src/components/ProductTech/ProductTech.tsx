import { type ReactElement } from "react";
import styles from "./ProductTech.module.css";

interface SpecCard {
  readonly category: string;
  readonly title: string;
  readonly description: string;
}

const SPEC_CARDS: readonly SpecCard[] = [
  {
    category: "Compute",
    title: "720 NVIDIA HGX B300 GPUs",
    description:
      "720 NVIDIA HGX B300 GPUs span 11 racks, with 288 GB HBM3e per GPU and NVLink 5 delivering full all-to-all bandwidth within each node.",
  },
  {
    category: "Processors",
    title: "Dual Intel Xeon 6 CPUs",
    description:
      "Per server, dual Granite Rapids processors and up to 4 TB of DDR5 give the host headroom to drive all eight GPUs at full utilization.",
  },
  {
    category: "Cooling",
    title: "Closed-loop Liquid Cooling",
    description:
      "A sealed, closed-loop liquid cooling system pulls heat directly off the GPUs and CPUs, sustaining peak clocks under continuous load while running quieter and denser than air.",
  },
  {
    category: "Build",
    title: "AI-Focused Design",
    description:
      "Engineered from the ground up for AI inference, training, and other specialized workloads, with fast InfiniBand interconnect tying nodes together for low-latency, high-bandwidth scale-out.",
  },
];

const RACK_IMAGE = "/images/zode-rack.png";
const RACK_ALT =
  "A stack of ZODE-branded rack servers lit in a dark data center.";

/**
 * Dark "tech" band shown above the "Supercharge your ZODE." section: a centered
 * header, a full-width image, and a 2x2 grid of spec cards beneath.
 */
export function ProductTech(): ReactElement {
  return (
    <section className={styles.tech} aria-label="Built on Frontier-Class GPUs">
      <h2 className={styles.header}>Built on Frontier-Class GPUs</h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={RACK_IMAGE} alt={RACK_ALT} />

      <div className={styles.grid}>
        {SPEC_CARDS.map((card) => (
          <article key={card.category} className={styles.card}>
            <p className={styles.cardCategory}>{card.category}</p>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            <p className={styles.cardDescription}>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

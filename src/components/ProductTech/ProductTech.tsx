"use client";

import { useState, type ReactElement } from "react";
import styles from "./ProductTech.module.css";

type Generation = "blackwell" | "rubin";

interface SpecCard {
  readonly category: string;
  readonly title: string;
  readonly description: string;
}

interface GenerationInfo {
  readonly id: Generation;
  readonly label: string;
  readonly image: string;
  readonly alt: string;
  readonly cards: readonly SpecCard[];
}

const BLACKWELL_CARDS: readonly SpecCard[] = [
  {
    category: "Compute",
    title: "8x NVIDIA Blackwell GPUs",
    description:
      "Eight Blackwell GPUs on the HGX B300 baseboard with 288 GB HBM3e per GPU and 2,304 GB total GPU memory. Connected via NVLink 5 for full all-to-all bandwidth within the node.",
  },
  {
    category: "Processors",
    title: "Dual Intel Xeon 6 CPUs",
    description:
      "Dual Granite Rapids processors with up to 4 TB DDR5 system memory. Enough host compute, I/O bandwidth, and memory capacity to keep all eight GPUs saturated.",
  },
  {
    category: "Cooling",
    title: "Air Cooling",
    description:
      "Supports air-cooling with an efficient thermal design optimized for sustained high-utilization workloads in dense rack environments. Direct liquid-cooled alternatives also available.",
  },
  {
    category: "Build",
    title: "AI-Focused Design",
    description:
      "Built by an OEM that specializes in GPU server infrastructure. The KR9288-X3 is designed specifically for AI workloads, not adapted from a general-purpose server platform.",
  },
];

const GENERATIONS: readonly GenerationInfo[] = [
  {
    id: "blackwell",
    label: "Blackwell",
    image: "/images/zode-rack.png",
    alt: "A stack of ZODE-branded rack servers lit in a dark data center.",
    cards: BLACKWELL_CARDS,
  },
  {
    id: "rubin",
    label: "Rubin",
    image: "/images/zode-rack.png",
    alt: "A stack of ZODE-branded rack servers lit in a dark data center.",
    cards: BLACKWELL_CARDS,
  },
];

/**
 * Dark "tech" band shown above the "Supercharge your ZODE." section: a centered
 * header, a full-width image, a left/right selector for GPU generation
 * (Blackwell / Rubin), and a 2x2 grid of spec cards beneath.
 */
export function ProductTech(): ReactElement {
  const [active, setActive] = useState<Generation>("blackwell");
  const current =
    GENERATIONS.find((generation) => generation.id === active) ?? GENERATIONS[0];

  return (
    <section className={styles.tech} aria-label="Powered using Frontier GPUs">
      <h2 className={styles.header}>Powered using Frontier GPUs</h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={current.image} alt={current.alt} />

      <div className={styles.selector} role="group" aria-label="GPU generation">
        {GENERATIONS.map((generation) => (
          <button
            key={generation.id}
            type="button"
            className={`${styles.option} ${
              generation.id === active ? styles.optionActive : ""
            }`}
            aria-pressed={generation.id === active}
            onClick={() => setActive(generation.id)}
          >
            {generation.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {current.cards.map((card) => (
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

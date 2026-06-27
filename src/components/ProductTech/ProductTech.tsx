"use client";

import { useState, type ReactElement } from "react";
import styles from "./ProductTech.module.css";

type Generation = "blackwell" | "rubin";

interface GenerationInfo {
  readonly id: Generation;
  readonly label: string;
  readonly image: string;
  readonly alt: string;
}

const GENERATIONS: readonly GenerationInfo[] = [
  {
    id: "blackwell",
    label: "Blackwell",
    image: "/images/zode-rack.png",
    alt: "A stack of ZODE-branded rack servers lit in a dark data center.",
  },
  {
    id: "rubin",
    label: "Rubin",
    image: "/images/zode-rack.png",
    alt: "A stack of ZODE-branded rack servers lit in a dark data center.",
  },
];

/**
 * Dark "tech" band shown above the "Supercharge your ZODE." section: a
 * left/right segmented selector switches between GPU generations (Blackwell /
 * Rubin) and swaps the full-width horizontal image beneath it.
 */
export function ProductTech(): ReactElement {
  const [active, setActive] = useState<Generation>("blackwell");
  const current =
    GENERATIONS.find((generation) => generation.id === active) ?? GENERATIONS[0];

  return (
    <section className={styles.tech} aria-label="Inside the compute">
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={current.image} alt={current.alt} />
    </section>
  );
}

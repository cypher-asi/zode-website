"use client";

import { useRef, type ReactElement } from "react";
import styles from "./ProductCards.module.css";

interface Card {
  readonly image: string;
  readonly title: string;
  readonly description: string;
  readonly objectPosition?: string;
}

const CARDS: readonly Card[] = [
  {
    image: "/product-hardware.png",
    title: "Frontier Hardware",
    description:
      "Racks of directly liquid-cooled NVIDIA B300 GPUs deliver frontier-scale training and inference at the highest density and efficiency available today.",
    objectPosition: "center top",
  },
  {
    image: "/product-secure-door.png",
    title: "Secure Facility",
    description:
      "A Faraday-caged enclosure shields every rack from interference and eavesdropping, while hardened steel entry, biometric access, and 24/7 surveillance lock your data down.",
  },
  {
    image: "/product-dry-cooler.png",
    title: "Extreme Quiet",
    description:
      "Heat is spread across multiple loops and rejected through oversized dry coolers running well below peak speed, holding roughly 55 dB(A), about 75% quieter than conventional cooling.",
    objectPosition: "center top",
  },
  {
    image: "/product-redundancy.png",
    title: "N+1 Redundancy",
    description:
      "Power, cooling, and networking all run at N+1 redundancy across the deployment, so any single component can fail and be serviced live without taking the site offline.",
    objectPosition: "center 12%",
  },
  {
    image: "/product-infiniband.png",
    title: "InfiniBand Networking",
    description:
      "NVIDIA Quantum-X800 InfiniBand links nodes at 800 Gb/s per port over ConnectX-8 SuperNICs with SHARP v4 in-network compute, scaling training and inference near-linearly beyond Ethernet.",
  },
];

/**
 * Horizontally scrolling showcase cards: an image with a title and caption
 * underneath, advanced by chevron controls or native drag/scroll with snap.
 */
export function ProductCards(): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: 1 | -1): void => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    const step = (firstCard?.clientWidth ?? track.clientWidth * 0.8) + gap;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section className={styles.section} aria-label="ZODE One highlights">
      <div className={styles.viewport}>
        <div className={styles.track} ref={trackRef}>
          {CARDS.map((card) => (
            <article key={card.title} className={styles.card}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.image}
                src={card.image}
                alt=""
                aria-hidden="true"
                style={card.objectPosition ? { objectPosition: card.objectPosition } : undefined}
              />
              <h3 className={styles.title}>{card.title}</h3>
              <p className={styles.description}>{card.description}</p>
            </article>
          ))}
        </div>

        <button
          type="button"
          className={`${styles.control} ${styles.prev}`}
          onClick={() => scrollByCard(-1)}
          aria-label="Previous card"
        >
          <Chevron direction="left" />
        </button>
        <button
          type="button"
          className={`${styles.control} ${styles.next}`}
          onClick={() => scrollByCard(1)}
          aria-label="Next card"
        >
          <Chevron direction="right" />
        </button>
      </div>
    </section>
  );
}

function Chevron({ direction }: { readonly direction: "left" | "right" }): ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "right" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

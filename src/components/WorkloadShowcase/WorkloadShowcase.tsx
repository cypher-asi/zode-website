import type { ReactElement } from "react";
import Link from "next/link";
import styles from "./WorkloadShowcase.module.css";

const WORKLOADS: readonly string[] = [
  "AI/ML Frameworks",
  "AI Text Generation",
  "AI Image + Video Generation",
  "AI Agents",
  "Batch Data Processing",
  "Audio-to-Text Transcription",
  "AI Fine Tuning",
  "Virtual Computing",
  "GPU Programming",
  "Graphics Rendering",
];

/**
 * "Built for Every AI Workload" band, placed after the constellation section.
 * Mirrors the reference layout: a cloud of workload tag pills on the left and a
 * media card with heading, copy, and a CTA on the right.
 */
export function WorkloadShowcase(): ReactElement {
  return (
    <section className={styles.section} aria-label="Built for every AI workload">
      <div className={styles.panel}>
        <ul className={styles.tags}>
          {WORKLOADS.map((workload) => (
            <li key={workload} className={styles.tag}>
              {workload}
            </li>
          ))}
        </ul>

        <div className={styles.card}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.image}
            src="/images/network-how.png"
            alt=""
            aria-hidden="true"
          />
          <div className={styles.scrim} aria-hidden="true" />
          <div className={styles.copy}>
            <h2 className={styles.title}>Built for Every AI Workload</h2>
            <p className={styles.description}>
              From training to inference, fine-tuning to rendering — run any GPU
              workload on THE GRID.
            </p>
            <Link className={styles.cta} href="/buy-compute">
              Use Cases
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Arrow(): ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import type { ReactElement } from "react";
import styles from "./ProductScale.module.css";

interface ScaleStep {
  readonly image: string;
  readonly alt: string;
  readonly title: string;
  readonly description: string;
}

const STEPS: readonly ScaleStep[] = [
  {
    image: "/product-hero.png",
    alt: "A single ZODE One unit sited in a remote valley at dusk.",
    title: "1.5 MW",
    description:
      "A single ZODE One. One module, sited and online in weeks, delivering 1.5 MW of dispatchable compute wherever the power already is.",
  },
  {
    image: "/images/zode-deploy.png",
    alt: "Several ZODE One modules linked together on one site.",
    title: "15 MW",
    description:
      "Link ten units into a cluster. Shared power and networking turn a row of modules into 15 MW of coordinated capacity on a single site.",
  },
  {
    image: "/images/zode-ring.png",
    alt: "An aerial view of a full ring of ZODE One units arranged in a clearing.",
    title: "42 MW",
    description:
      "Scale to a full ring. Dozens of ZODE One units combine into a 42 MW campus, all running on renewable-first power and liquid cooling.",
  },
];

/**
 * Dark "Combine ZODES for more compute." band shown above the specs section:
 * a left-aligned header followed by three image cards that step up in scale
 * (1.5 MW single unit / 15 MW cluster / 42 MW full ring).
 */
export function ProductScale(): ReactElement {
  return (
    <section className={styles.scale} aria-label="Combine ZODES for more compute">
      <div className={styles.intro}>
        <h2 className={styles.header}>Combine ZODES for more compute.</h2>
      </div>
      <div className={styles.row}>
        {STEPS.map((step) => (
          <div key={step.title} className={styles.item}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.image} src={step.image} alt={step.alt} />
            <h3 className={styles.itemTitle}>{step.title}</h3>
            <p className={styles.itemDescription}>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

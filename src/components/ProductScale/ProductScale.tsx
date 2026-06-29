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
    image: "/images/zode-single.png",
    alt: "An aerial view of a single ZODE One unit set among solar arrays and trees.",
    title: "1.5 MW",
    description:
      "A single ZODE One. One module, sited and online in weeks, delivering 1.5 MW of dispatchable compute wherever the power already is.",
  },
  {
    image: "/images/zode-cluster.png",
    alt: "An aerial view of several ZODE One units arranged in a cluster on one site.",
    title: "9 MW",
    description:
      "Link several units into a cluster. Shared power and networking turn a group of modules into 9 MW of coordinated capacity on a single site.",
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
    <section className={styles.scale} aria-label="Supercharge your ZODE">
      <div className={styles.intro}>
        <h2 className={styles.header}>Supercharge your ZODE.</h2>
        <p className={styles.subheader}>
          ZODES can link to create more powerful sites.
        </p>
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

import Link from "next/link";
import type { ReactElement } from "react";
import { PageHeader } from "@/features/portal/sections";
import portal from "@/features/portal/portal.module.css";
import { FACTORY_FLOWS, type FactoryFlow } from "./model/flows";
import styles from "./flows.module.css";

/** A flow not yet designed in full: what it will cover, in order, and where it sits among the others. */
export function FlowOutline({ flow }: { flow: FactoryFlow }): ReactElement {
  const index = FACTORY_FLOWS.indexOf(flow);
  const before = FACTORY_FLOWS[index - 1];
  const after = FACTORY_FLOWS[index + 1];
  return (
    <div className={portal.page}>
      <PageHeader title={flow.label} subtitle={flow.summary} />
      <p className={styles.status}>
        Outlined. Inbound &amp; receiving is designed and simulated in full first; this flow follows the same way, step
        by step, in the order material moves.
      </p>
      <ol className={styles.outline}>
        {flow.outline.map((step, i) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number}>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className={styles.stepTitle}>{step.title}</h2>
              <p className={styles.stepDetail}>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <nav className={styles.neighbours} aria-label="Flows">
        {before ? (
          <Link href={before.href} className={styles.neighbour}>
            <span>Before</span>
            {before.label}
          </Link>
        ) : null}
        {after ? (
          <Link href={after.href} className={styles.neighbour} data-next="">
            <span>After</span>
            {after.label}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

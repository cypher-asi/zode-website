import type { ReactElement } from "react";
import styles from "./Card.module.css";

/**
 * Typographic stat block: a gray uppercase label, a large lighter value, and
 * optional supporting copy. Borderless with no background. Used for the
 * Solution stat cards and the Opportunity / Market tier cards.
 */
export function FeatureCard({
  label,
  value,
  description,
  align = "start",
}: {
  label: string;
  value: string;
  description?: string;
  /** Text/box alignment. `center` is used by the Market tier cards. */
  align?: "start" | "center";
}): ReactElement {
  return (
    <div className={styles.feature} data-align={align}>
      <p className={styles.featureLabel}>{label}</p>
      <p className={styles.featureValue}>{value}</p>
      {description && <p className={styles.featureDescription}>{description}</p>}
    </div>
  );
}

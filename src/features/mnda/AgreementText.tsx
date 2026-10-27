import type { ReactElement } from "react";
import type { MndaTemplate } from "./templates";
import styles from "./Mnda.module.css";

/** One version of the agreement in full, in a scrolling panel, for review before signing. */
export function AgreementText({ template }: { template: MndaTemplate }): ReactElement {
  return (
    // Focusable so keyboard users can scroll it.
    <section className={styles.agreement} tabIndex={0} aria-label="Mutual Nondisclosure Agreement text">
      <h2 className={styles.agreementTitle}>Mutual Nondisclosure Agreement</h2>
      <p className={styles.agreementParagraph}>{template.preamble}</p>
      {template.sections.map((section) => (
        <p key={section.heading} className={styles.agreementParagraph}>
          <strong>{section.heading}.</strong> {section.body}
        </p>
      ))}
      <p className={styles.agreementParagraph}>{template.closing}</p>
    </section>
  );
}

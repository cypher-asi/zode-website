import type { ReactElement } from "react";
import { PREAMBLE, SECTIONS } from "./agreement";
import styles from "./Mnda.module.css";

/** The full agreement in a scrolling panel, for review before signing. */
export function AgreementText(): ReactElement {
  return (
    // Focusable so keyboard users can scroll it.
    <section className={styles.agreement} tabIndex={0} aria-label="Mutual Nondisclosure Agreement text">
      <h2 className={styles.agreementTitle}>Mutual Nondisclosure Agreement</h2>
      <p className={styles.agreementParagraph}>{PREAMBLE}</p>
      {SECTIONS.map((section) => (
        <p key={section.heading} className={styles.agreementParagraph}>
          <strong>{section.heading}.</strong> {section.body}
        </p>
      ))}
      <p className={styles.agreementParagraph}>
        IN WITNESS WHEREOF, the parties hereto have executed this Agreement as a sealed instrument, effective as of the
        date and year first written above.
      </p>
    </section>
  );
}

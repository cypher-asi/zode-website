import type { ReactElement } from "react";
import Link from "next/link";
import styles from "./LegalDocument.module.css";

export interface LegalSection {
  heading: string;
  body: string[];
}

interface LegalDocumentProps {
  eyebrow?: string;
  title: string;
  description: string;
  effectiveDate?: string;
  intro?: string;
  sections: LegalSection[];
  contactHeading?: string;
  contactBody: string;
  email: string;
}

export function LegalDocument({
  eyebrow = "LEGAL",
  title,
  description,
  effectiveDate,
  intro,
  sections,
  contactHeading = "Contact us",
  contactBody,
  email,
}: LegalDocumentProps): ReactElement {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.heading}>{title}</h1>
        <p className={styles.subtitle}>{description}</p>
      </header>

      <div className={styles.document}>
        {effectiveDate ? (
          <p className={styles.effectiveDate}>{effectiveDate}</p>
        ) : null}
        {intro ? <p className={styles.intro}>{intro}</p> : null}

        {sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.sectionHeading}>{section.heading}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index} className={styles.paragraph}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>{contactHeading}</h2>
          <p className={styles.paragraph}>{contactBody}</p>
          <a className={styles.contactEmail} href={`mailto:${email}`}>
            {email}
          </a>
        </section>
      </div>

      <p className={styles.backRow}>
        <Link className={styles.backLink} href="/">
          Back to home
        </Link>
      </p>
    </div>
  );
}

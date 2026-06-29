import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const EMAIL = "hello@cypher.net";

export const metadata: Metadata = {
  title: "Contact | ZODE",
  description: "Get in touch with Cypher, Inc.",
};

export default function ContactPage(): ReactElement {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>GET IN TOUCH</p>
        <h1 className={styles.heading}>Contact</h1>
        <p className={styles.subtitle}>
          Questions, partnerships, or press? Reach out and we&apos;ll get back to
          you as soon as we can.
        </p>
      </header>

      <section className={styles.emailBlock}>
        <span className={styles.emailLabel}>Email</span>
        <a className={styles.emailLink} href={`mailto:${EMAIL}`}>
          {EMAIL}
        </a>
      </section>

      <p className={styles.backRow}>
        <Link className={styles.backLink} href="/">
          Back to home
        </Link>
      </p>
    </div>
  );
}

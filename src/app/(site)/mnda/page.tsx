import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AgreementText } from "@/features/mnda/AgreementText";
import { MndaSigner } from "@/features/mnda/MndaSigner";
import styles from "@/features/mnda/Mnda.module.css";

export const metadata: Metadata = {
  title: "Mutual NDA | ZODE",
  description: "Review and sign ZODE's standard mutual nondisclosure agreement online.",
};

export default function MndaPage(): ReactElement {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>RESOURCES</p>
        <h1 className={styles.heading}>Mutual NDA</h1>
        <p className={styles.subtitle}>
          ZODE&apos;s standard mutual nondisclosure agreement, for exploring a business relationship with ZODE Inc.
          Review it, enter your entity&apos;s details and sign. ZODE countersigns right away, and both parties get the
          executed PDF by email.
        </p>
      </header>
      <AgreementText />
      <MndaSigner />
    </div>
  );
}

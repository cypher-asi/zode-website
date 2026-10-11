import type { Metadata } from "next";
import type { ReactElement } from "react";
import { EngineerCard } from "@/features/engineer-request/EngineerCard";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Talk to an Engineer | ZODE",
  description: "Tell us what you need and a ZODE engineer will email or text you to schedule a meeting.",
};

/** Direct visits and refreshes; links on the site open the same card as a modal (see app/@modal). */
export default function TalkToAnEngineerPage(): ReactElement {
  return (
    <div className={styles.page}>
      <EngineerCard />
    </div>
  );
}

import type { Metadata } from "next";
import type { ReactElement } from "react";
import { InvestorCard } from "@/features/investor-request/InvestorCard";
import styles from "../talk-to-an-engineer/page.module.css";

export const metadata: Metadata = {
  title: "Invest | ZODE",
  description: "Tell us about your investment and the ZODE team will follow up with materials.",
};

/** Direct visits and refreshes; links on the site open the same card as a modal (see app/@modal). */
export default function InvestPage(): ReactElement {
  return (
    <div className={styles.page}>
      <InvestorCard />
    </div>
  );
}

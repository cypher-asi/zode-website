import type { ReactElement } from "react";
import { RouteModal } from "@/components/ui/RouteModal";
import { InvestorCard } from "@/features/investor-request/InvestorCard";
import styles from "@/features/engineer-request/EngineerCard.module.css";

/** "Invest" opened from a link on the site: the card over the current page. */
export default function InvestModal(): ReactElement {
  return (
    <RouteModal className={styles.modal} label="Invest in ZODE">
      <InvestorCard />
    </RouteModal>
  );
}

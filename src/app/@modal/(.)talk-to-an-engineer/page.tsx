import type { ReactElement } from "react";
import { RouteModal } from "@/components/ui/RouteModal";
import { display, text } from "@/lib/fonts";
import { EngineerCard } from "@/features/engineer-request/EngineerCard";
import styles from "@/features/engineer-request/EngineerCard.module.css";

/** "Talk to an Engineer" opened from a link on the site: the card over the current page. */
export default function TalkToAnEngineerModal(): ReactElement {
  return (
    <RouteModal className={`${styles.modal} ${display.variable} ${text.variable}`} label="Talk to an Engineer">
      <EngineerCard />
    </RouteModal>
  );
}

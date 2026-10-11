import type { ReactElement } from "react";
import { RouteModal } from "@/components/RouteModal";
import { display, text } from "@/lib/fonts";
import { EngineerCard } from "../../(site)/talk-to-an-engineer/EngineerCard";
import styles from "../../(site)/talk-to-an-engineer/EngineerCard.module.css";

/** "Talk to an Engineer" opened from a link on the site: the card over the current page. */
export default function TalkToAnEngineerModal(): ReactElement {
  return (
    <RouteModal className={`${styles.modal} ${display.variable} ${text.variable}`} label="Talk to an Engineer">
      <EngineerCard />
    </RouteModal>
  );
}

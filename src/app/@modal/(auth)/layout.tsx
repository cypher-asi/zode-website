import type { ReactElement, ReactNode } from "react";
import { RouteModal } from "@/components/ui/RouteModal";
import { AUTH_TITLE_ID } from "@/features/account/AuthPanel";
import styles from "@/features/account/auth.module.css";

/** Stays mounted when switching between log in and register, so only the card's contents change. */
export default function AuthModalLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <RouteModal className={styles.modal} labelledBy={AUTH_TITLE_ID}>
      {children}
    </RouteModal>
  );
}

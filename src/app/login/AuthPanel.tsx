"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { GridLogo } from "@/components/GridLogo";
import { useModalClose } from "@/components/RouteModal";
import { RegisterForm } from "../register/RegisterForm";
import { LoginForm } from "./LoginForm";
import styles from "./auth.module.css";

export type AuthMode = "login" | "register";

/** Id of the panel's heading, which labels the modal around it. */
export const AUTH_TITLE_ID = "auth-title";

const COPY = {
  login: {
    title: "Log in",
    prompt: "Use your ZOS account.",
    switchText: "No account?",
    switchLabel: "Register",
    switchPath: "/register",
  },
  register: {
    title: "Create your account",
    prompt: "Register a new ZOS account.",
    switchText: "Have an account?",
    switchLabel: "Log in",
    switchPath: "/login",
  },
} as const;

/**
 * The log in or register card, shared by the standalone pages and the modal
 * over the current page. The close button steps back out of the modal, or
 * goes home from a standalone page.
 */
export function AuthPanel({ mode, next }: { mode: AuthMode; next: string }): ReactElement {
  const close = useModalClose();
  const copy = COPY[mode];
  const switchHref = next === "/portal" ? copy.switchPath : `${copy.switchPath}?next=${encodeURIComponent(next)}`;
  const closeIcon = (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
  const brand = (
    <>
      <GridLogo showWordmark={false} />
      <span className={styles.wordmark}>ZODE</span>
    </>
  );

  return (
    <div className={close ? `${styles.panel} ${styles.inModal}` : styles.panel}>
      {close ? (
        <button type="button" className={styles.close} onClick={close} aria-label="Close">
          {closeIcon}
        </button>
      ) : (
        <Link className={styles.close} href="/" aria-label="Close">
          {closeIcon}
        </Link>
      )}
      {close ? (
        <div className={styles.brand}>{brand}</div>
      ) : (
        <Link className={styles.brand} href="/" aria-label="ZODE — home">
          {brand}
        </Link>
      )}
      <h1 id={AUTH_TITLE_ID} className={styles.title}>
        {copy.title}
      </h1>
      <p className={styles.prompt}>{copy.prompt}</p>
      {mode === "login" ? <LoginForm next={next} /> : <RegisterForm next={next} />}
      <p className={styles.switch}>
        {copy.switchText}{" "}
        {/* Replaced in the modal, so closing it still steps back to the page underneath. */}
        <Link href={switchHref} replace={close !== null}>
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}

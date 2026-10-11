import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GridLogo } from "@/components/GridLogo";
import { getAccount, safeNext } from "@/lib/account-session";
import { LoginForm } from "./LoginForm";
import styles from "./auth.module.css";

export const metadata: Metadata = {
  title: "Log in | ZODE",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<ReactElement> {
  const { next } = await searchParams;
  const destination = safeNext(next);
  if (await getAccount()) {
    redirect(destination);
  }

  const registerHref = destination === "/portal" ? "/register" : `/register?next=${encodeURIComponent(destination)}`;

  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <Link className={styles.brand} href="/" aria-label="ZODE — home">
          <GridLogo showWordmark={false} />
          <span className={styles.wordmark}>ZODE</span>
        </Link>
        <h1 className={styles.title}>Log in</h1>
        <p className={styles.prompt}>Use your ZOS account.</p>
        <LoginForm next={destination} />
        <p className={styles.switch}>
          No account? <Link href={registerHref}>Register</Link>
        </p>
      </div>
    </main>
  );
}

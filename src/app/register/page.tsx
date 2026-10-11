import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GridLogo } from "@/components/GridLogo";
import { getAccount, safeNext } from "@/lib/account-session";
import { RegisterForm } from "./RegisterForm";
import styles from "../login/auth.module.css";

export const metadata: Metadata = {
  title: "Register | ZODE",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<ReactElement> {
  const { next } = await searchParams;
  const destination = safeNext(next);
  if (await getAccount()) {
    redirect(destination);
  }

  const loginHref = destination === "/portal" ? "/login" : `/login?next=${encodeURIComponent(destination)}`;

  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <Link className={styles.brand} href="/" aria-label="ZODE — home">
          <GridLogo showWordmark={false} />
          <span className={styles.wordmark}>ZODE</span>
        </Link>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.prompt}>Register a new ZOS account.</p>
        <RegisterForm next={destination} />
        <p className={styles.switch}>
          Have an account? <Link href={loginHref}>Log in</Link>
        </p>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { getAccount, safeNext } from "@/lib/account-session";
import { AuthPanel } from "../login/AuthPanel";
import styles from "../login/auth.module.css";

export const metadata: Metadata = {
  title: "Register | ZODE",
};

/** Direct visits and refreshes; links on the site open the same panel as a modal (see app/@modal). */
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

  return (
    <main className={styles.shell}>
      <AuthPanel mode="register" next={destination} />
    </main>
  );
}

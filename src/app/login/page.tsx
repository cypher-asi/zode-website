import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { redirect } from "next/navigation";
import { ShellBackdrop } from "@/components/layout/ShellBackdrop";
import { getAccount, safeNext } from "@/features/account/session";
import { AuthPanel } from "@/features/account/AuthPanel";
import styles from "@/features/account/auth.module.css";

export const metadata: Metadata = {
  title: "Log in | ZODE",
};

/** Direct visits and refreshes; links on the site open the same panel as a modal (see app/@modal). */
export default function LoginPage({ searchParams }: PageProps<"/login">): ReactElement {
  return (
    <main className={styles.shell}>
      <ShellBackdrop />
      <Suspense>
        <SignedOutPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Behind Suspense because the session check reads the clock and the database, which a prefetch can't. */
async function SignedOutPanel({ searchParams }: Pick<PageProps<"/login">, "searchParams">): Promise<ReactElement> {
  const { next } = await searchParams;
  const destination = safeNext(next);
  if (await getAccount()) {
    redirect(destination);
  }
  return <AuthPanel mode="login" next={destination} />;
}

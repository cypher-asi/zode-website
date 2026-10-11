import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { getAccount, safeNext } from "@/lib/account-session";
import { AuthPanel } from "../../../login/AuthPanel";

/** Log in opened from a link on the site: the panel over the current page. */
export default async function LoginModal({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<ReactElement> {
  const { next } = await searchParams;
  const destination = safeNext(next);
  if (await getAccount()) {
    redirect(destination);
  }

  return <AuthPanel mode="login" next={destination} />;
}

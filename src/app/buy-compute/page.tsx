import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/session";
import { PinnedHeader } from "../(home)/PinnedHeader";
import { Configurator } from "./Configurator";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Buy Compute | ZODE",
  description: "Configure your own ZODE: compute platform, workload, networking and redundancy, with live pricing.",
};

const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const text = Inter({
  variable: "--font-text",
  subsets: ["latin"],
});

/**
 * Build-your-own ZODE configurator, laid out like a car maker's build page:
 * configuration steps on the left, the ZODE drawing on the right and a
 * pricing bar along the bottom. Lives outside the `(site)` group, like
 * the home page, so it fills the viewport without the shared nav and taskbar.
 */
export default async function BuyComputePage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return (
    <main className={`${styles.page} ${display.variable} ${text.variable}`}>
      <PinnedHeader showAction={false} />
      <Configurator />
    </main>
  );
}

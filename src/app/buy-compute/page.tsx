import type { Metadata } from "next";
import { PinnedHeader } from "@/components/layout/PinnedHeader";
import { Configurator } from "@/features/configurator/Configurator";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Buy Compute | ZODE",
  description:
    "Configure your own ZODE, or rent a cluster: compute, networking, storage and CPUs, with live pricing.",
};

/**
 * Build-your-own ZODE configurator, laid out like a car maker's build page:
 * the ZODE drawing on the left, configuration steps on the right and a
 * pricing bar along the bottom. Lives outside the `(site)` group, like
 * the home page, so it fills the viewport without the shared nav and taskbar.
 * `?mode=rent` opens it on the rental configurator.
 */
export default async function BuyComputePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { mode } = await searchParams;

  return (
    <main className={styles.page}>
      <PinnedHeader showAction={false} />
      <Configurator initialMode={mode === "rent" ? "rent" : "buy"} />
    </main>
  );
}

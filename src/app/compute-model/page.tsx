import type { Metadata } from "next";
import { PinnedHeader } from "@/components/layout/PinnedHeader";
import { ComputeModel } from "@/features/compute-model/ComputeModel";
import { nextMonthStart } from "@/features/compute-model/model/engine";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Compute Model | ZODE",
  description:
    "Model a GPU cluster SPV: contract and merchant revenue, facility costs, DSCR-sized debt and the preferred equity waterfall, with live IRR and equity required.",
};

/**
 * The GPU SPV financial model, a resource linked from the footer and header
 * menus. Lives outside the `(site)` group, like /buy-compute, so the results
 * and the inputs panel fill the viewport. Inputs are read from the query
 * string so shared links open on the same case. The forecast starts on the
 * first of next month, settled here so the server and browser agree on it.
 */
export default async function ComputeModelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params[key] = value;
  }

  return (
    <main className={styles.page}>
      <PinnedHeader showAction={false} />
      <ComputeModel initialParams={params} start={nextMonthStart()} />
    </main>
  );
}

import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ui from "@/features/data-room/ui.module.css";
import { requireTeam } from "@/features/zrm/access";
import { NEW_LABELS } from "@/features/zrm/columns";
import { isKind, type ZrmKind } from "@/features/zrm/types";
import styles from "@/features/zrm/zrm.module.css";

const PROMPTS: Record<ZrmKind, string> = {
  people: "a person",
  companies: "a company",
  opportunities: "an opportunity",
};

/** The right pane before a record is picked. */
export default async function KindPage({ params }: PageProps<"/portal/zrm/[kind]">): Promise<ReactElement> {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  await requireTeam(`/portal/zrm/${kind}`);

  return (
    <div className={styles.placeholder}>
      <p>Select {PROMPTS[kind]} to see the details.</p>
      <Link href={`/portal/zrm/${kind}/new`} className={ui.button}>
        {NEW_LABELS[kind]}
      </Link>
    </div>
  );
}

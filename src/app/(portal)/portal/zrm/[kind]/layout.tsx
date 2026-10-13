import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { requireTeam } from "@/features/zrm/access";
import { listRows, listTypes } from "@/features/zrm/queries";
import { isKind } from "@/features/zrm/types";
import { Workspace } from "@/features/zrm/Workspace";

/** A ZRM tab's list, which stays put while records open beside it. */
export default async function KindLayout({ children, params }: LayoutProps<"/portal/zrm/[kind]">): Promise<ReactElement> {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  await requireTeam(`/portal/zrm/${kind}`);
  const [data, types] = await Promise.all([listRows(kind), listTypes()]);

  return (
    <Workspace data={data} types={types}>
      {children}
    </Workspace>
  );
}

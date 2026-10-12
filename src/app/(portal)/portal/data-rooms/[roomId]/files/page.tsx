import { redirect } from "next/navigation";

/** Files moved to the room's landing page; links to `/files?file=` predate that. */
export default async function DataRoomFilesPage({
  params,
  searchParams,
}: PageProps<"/portal/data-rooms/[roomId]/files">): Promise<never> {
  const { roomId } = await params;
  const { file } = await searchParams;
  redirect(`/portal/data-rooms/${roomId}${typeof file === "string" ? `?file=${encodeURIComponent(file)}` : ""}`);
}

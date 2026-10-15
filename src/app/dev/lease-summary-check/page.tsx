import { readFileSync } from "node:fs";
import { SummaryView } from "@/features/data-room/SummaryView";
import type { DiligenceSummary } from "@/features/data-room/summary";

const withIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withIds);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === "sources" && Array.isArray(v) ? v.map((p: string) => ({ path: p, fileId: p })) : withIds(v),
      ]),
    );
  }
  return value;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ file?: string }> }) {
  const { file = "summary.json" } = await searchParams;
  const raw = JSON.parse(readFileSync(`/home/n3o/Downloads/801-canal-vdr-work/${file}`, "utf8"));
  const summary = {
    kind: "lease",
    ...(withIds(raw) as object),
    updatedAt: new Date().toISOString(),
    updatedBy: "n3o@zero.tech",
  } as DiligenceSummary;
  const names = new Map<string, string>();
  JSON.stringify(raw, (k, v) => {
    if (k === "sources") for (const p of v as string[]) names.set(p, p.split("/").pop()!);
    return v;
  });
  return (
    <main style={{ padding: 24 }}>
      <SummaryView roomId="dev" summary={{ ...summary, sourceNames: names, site: null }} />
    </main>
  );
}

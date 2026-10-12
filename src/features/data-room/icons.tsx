import type { ReactElement } from "react";
import type { FileKind } from "./fileKinds";

const paths = {
  chevron: "M6 4l4 4-4 4",
  folder: "M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z",
  folderOpen:
    "M2 11.5v-7A1.5 1.5 0 0 1 3.5 3h3L8 4.5h3.5A1.5 1.5 0 0 1 13 6v1M2 11.5l1.6-3.6A1.5 1.5 0 0 1 5 7h8.6a.9.9 0 0 1 .85 1.2l-1.2 3.6A1.7 1.7 0 0 1 11.6 13H3.5A1.5 1.5 0 0 1 2 11.5z",
  file: "M4 1.5h5l3.5 3.5v9a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1zM9 1.5V5h3.5",
  download: "M8 2v8m0 0L5 7m3 3 3-3M3 12.5v1h10v-1",
  upload: "M8 11V3m0 0L5 6m3-3 3 3M3 12.5v1h10v-1",
  folderPlus: "M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5zM8 6.5v4M6 8.5h4",
  more: "M3.5 8h.01M8 8h.01M12.5 8h.01",
  zoomIn: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5M5 7h4M7 5v4",
  zoomOut: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5M5 7h4",
  fit: "M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5",
  search: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5",
  close: "M4 4l8 8M12 4l-8 8",
  back: "M10 3 5 8l5 5",
  prev: "M10 3 5 8l5 5",
  next: "M6 3l5 5-5 5",
  summary: "M2.5 4.25l1 1 1.75-1.75M2.5 8.25l1 1 1.75-1.75M2.5 12.25l1 1 1.75-1.75M7.5 4.5h6M7.5 8.5h6M7.5 12.5h6",
  userPlus: "M6.5 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 13.5c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4M12.5 5v4M10.5 7h4",
} as const;

export function Icon({ name, className }: { name: keyof typeof paths; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}

const KIND_COLORS: Record<FileKind, string> = {
  pdf: "#d92d20",
  image: "#7a5af8",
  video: "#dd2590",
  audio: "#e04f16",
  text: "#667085",
  csv: "#079455",
  docx: "#1570ef",
  xlsx: "#079455",
  pptx: "#e04f16",
  other: "#98a2b3",
};

/** A page glyph tinted by file type, as file managers do. */
export function FileGlyph({ kind, className }: { kind: FileKind; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} style={{ color: KIND_COLORS[kind] }}>
      <path d={paths.file} />
    </svg>
  );
}

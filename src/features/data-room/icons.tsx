import type { ReactElement } from "react";
import type { FileKind } from "./fileKinds";

const paths = {
  chevron: "M6 4l4 4-4 4",
  folder: "M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z",
  folderOpen:
    "M2 11.5v-7A1.5 1.5 0 0 1 3.5 3h3L8 4.5h3.5A1.5 1.5 0 0 1 13 6v1M2 11.5l1.6-3.6A1.5 1.5 0 0 1 5 7h8.6a.9.9 0 0 1 .85 1.2l-1.2 3.6A1.7 1.7 0 0 1 11.6 13H3.5A1.5 1.5 0 0 1 2 11.5z",
  file: "M4 1.5h5l3.5 3.5v9a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1zM9 1.5V5h3.5",
  download: "M8 2v8m0 0L5 7m3 3 3-3M3 12.5v1h10v-1",
  external: "M5.5 3.5h7v7M12.5 3.5l-9 9",
  upload: "M8 11V3m0 0L5 6m3-3 3 3M3 12.5v1h10v-1",
  folderPlus: "M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5zM8 6.5v4M6 8.5h4",
  more: "M3.5 8h.01M8 8h.01M12.5 8h.01",
  plus: "M8 3v10M3 8h10",
  zoomIn: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5M5 7h4M7 5v4",
  zoomOut: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5M5 7h4",
  expand: "M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9",
  collapse: "M13.5 2.5 9.5 6.5M9.5 3v3.5H13M2.5 13.5l4-4M6.5 13V9.5H3",
  fullscreen: "M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5",
  exitFullscreen: "M5.5 2v3.5H2M10.5 2v3.5H14M14 10.5h-3.5V14M2 10.5h3.5V14",
  search: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.5-3.5",
  close: "M4 4l8 8M12 4l-8 8",
  back: "M10 3 5 8l5 5",
  prev: "M10 3 5 8l5 5",
  next: "M6 3l5 5-5 5",
  summary: "M2.5 4.25l1 1 1.75-1.75M2.5 8.25l1 1 1.75-1.75M2.5 12.25l1 1 1.75-1.75M7.5 4.5h6M7.5 8.5h6M7.5 12.5h6",
  userPlus: "M6.5 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 13.5c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4M12.5 5v4M10.5 7h4",
  arrowDown: "M8 2.5v11M3.5 9 8 13.5 12.5 9",
  page: "M3.5 1.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM5 4.5h6M5 7.5h6M5 10.5h3.5",
  slides: "M1.5 2.5h13M2.5 2.5v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-7M8 10.5V13M5.5 14.5 8 13l2.5 1.5",
  pencil: "M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3",
  copy: "M5.5 5.5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM2.5 10.5v-7a1 1 0 0 1 1-1h7",
  check: "M3 8.5l3.5 3.5L13 4.5",
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

export type FileKind = "pdf" | "image" | "video" | "audio" | "text" | "csv" | "docx" | "xlsx" | "pptx" | "other";

const BY_EXTENSION: Record<string, FileKind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  aac: "audio",
  flac: "audio",
  txt: "text",
  md: "text",
  json: "text",
  log: "text",
  yaml: "text",
  yml: "text",
  csv: "csv",
  tsv: "csv",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
};

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** How the viewer previews a file; `other` falls back to details and a download button. */
export function fileKind(name: string): FileKind {
  return BY_EXTENSION[extensionOf(name)] ?? "other";
}

/** A short label for the file list, e.g. "PDF" or "XLSX". */
export function typeLabel(name: string): string {
  return extensionOf(name).toUpperCase() || "FILE";
}

/**
 * Types a browser would run script from if served inline on our origin. They're
 * only ever sent as opaque attachments.
 */
const ACTIVE_CONTENT = /^(text\/html|application\/xhtml|image\/svg|text\/xml|application\/xml|application\/javascript|text\/javascript)/i;
const ACTIVE_EXTENSIONS = new Set(["html", "htm", "xhtml", "svg", "svgz", "xml", "js", "mjs"]);

export function isActiveContent(name: string, contentType: string): boolean {
  return ACTIVE_CONTENT.test(contentType) || ACTIVE_EXTENSIONS.has(extensionOf(name));
}

const units = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

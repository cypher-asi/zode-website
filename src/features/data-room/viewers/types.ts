import type { PreviewFile } from "../types";

/** A fixed scale (1 = 100%), or fit the content to the panel. */
export type Zoom = number | "fit";

export interface ViewerProps {
  /** Same-origin, access-checked URL of the file's bytes. */
  url: string;
  file: PreviewFile;
  zoom: Zoom;
  /** Reports what "fit" currently works out to, so zooming in or out starts from it. */
  onFitScale: (scale: number) => void;
}

/** Fetches a file the viewer renders itself, failing on non-2xx so revoked access shows an error. */
export async function fetchFile(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 404 ? "This file is no longer available to you." : "The file couldn't be loaded.");
  return res.arrayBuffer();
}

"use client";

import { useCallback, useState } from "react";
import { upload } from "@vercel/blob/client";
import { registerUploadAction } from "./actions";

export interface UploadItem {
  id: string;
  name: string;
  /** 0 to 100. */
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

export interface Uploads<T> {
  items: UploadItem[];
  start: (files: File[], target: T) => void;
  dismiss: () => void;
}

const PARALLEL = 3;
const MULTIPART_BYTES = 64 * 1024 * 1024;

/** Blob pathnames stay URL-safe; the display name is stored separately, exactly as chosen. */
const safeSegment = (name: string): string => name.replace(/[^\w.-]+/g, "_").slice(-120) || "file";

/**
 * Uploads files straight from the browser to the private Blob store under
 * `prefix`, a few at a time, through the client tokens `handleUploadUrl`
 * issues, then has `register` record each against `target` (resolving with
 * an error to show). `register` should be stable across renders.
 */
export function useBlobUploads<T>({
  prefix,
  handleUploadUrl,
  register,
}: {
  prefix: string;
  handleUploadUrl: string;
  register: (target: T, pathname: string, name: string) => Promise<{ error?: string }>;
}): Uploads<T> {
  const [items, setItems] = useState<UploadItem[]>([]);

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  const start = useCallback(
    (files: File[], target: T) => {
      const queue = files.map((file) => ({ file, id: crypto.randomUUID() }));
      setItems((current) => [
        ...current.filter((item) => item.status !== "done"),
        ...queue.map(({ file, id }) => ({ id, name: file.name, progress: 0, status: "queued" as const })),
      ]);

      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { file, id } = next;
          patch(id, { status: "uploading" });
          try {
            const blob = await upload(`${prefix}${safeSegment(file.name)}`, file, {
              access: "private",
              handleUploadUrl,
              contentType: file.type || undefined,
              multipart: file.size > MULTIPART_BYTES,
              onUploadProgress: ({ percentage }) => patch(id, { progress: Math.round(percentage) }),
            });
            const result = await register(target, blob.pathname, file.name);
            patch(id, result.error ? { status: "error", error: result.error } : { status: "done", progress: 100 });
          } catch (error) {
            patch(id, { status: "error", error: error instanceof Error ? error.message : "Upload failed." });
          }
        }
      };
      const workers = Math.min(PARALLEL, queue.length);
      for (let i = 0; i < workers; i += 1) void worker();
    },
    [patch, prefix, handleUploadUrl, register],
  );

  const dismiss = useCallback(() => setItems((current) => current.filter((item) => item.status === "uploading" || item.status === "queued")), []);

  return { items, start, dismiss };
}

/** Uploads into a data room's folder, recording each file in the room. The server refreshes the tree as each one lands. */
export function useUploads(roomId: string): Uploads<string | null> {
  const register = useCallback(
    (folderId: string | null, pathname: string, name: string) => registerUploadAction(roomId, folderId, pathname, name),
    [roomId],
  );
  return useBlobUploads({ prefix: `data-rooms/${roomId}/`, handleUploadUrl: `/api/data-rooms/${roomId}/upload`, register });
}

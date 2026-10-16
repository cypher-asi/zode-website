"use client";

import type { ReactElement } from "react";
import type { Uploads } from "./useUploads";
import styles from "./DataRoomApp.module.css";

/** Uploads in flight under a file list, each with its progress, then Done or why it failed. */
export function UploadList({ uploads }: { uploads: Pick<Uploads<unknown>, "items" | "dismiss"> }): ReactElement | null {
  if (!uploads.items.length) return null;
  const active = uploads.items.filter((item) => item.status === "uploading" || item.status === "queued").length;
  return (
    <div className={styles.uploads} aria-live="polite">
      <div className={styles.uploadsHeader}>
        <span>{active ? `Uploading ${active} file${active === 1 ? "" : "s"}…` : "Uploads"}</span>
        {active ? null : (
          <button type="button" onClick={uploads.dismiss}>
            Dismiss
          </button>
        )}
      </div>
      <ul>
        {uploads.items.map((item) => (
          <li key={item.id} data-status={item.status}>
            <span className={styles.uploadName}>{item.name}</span>
            <span className={styles.uploadState}>
              {item.status === "error" ? item.error : item.status === "done" ? "Done" : `${item.progress}%`}
            </span>
            <span className={styles.uploadBar} style={{ width: `${item.progress}%` }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

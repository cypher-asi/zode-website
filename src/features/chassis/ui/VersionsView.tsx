"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";
import { createDesignAction, versionDataAction } from "../actions";
import { useDesign } from "../store";
import { designHref, type VersionInfo } from "../types";
import styles from "../chassis.module.css";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/**
 * Every saved version of the design, newest first. An older one opens in the
 * editor as unsaved edits over the latest, so saving it restores it as the
 * next version; or it can start a new design of its own.
 */
export function VersionsView({
  designId,
  designName,
  versions,
}: {
  designId: string;
  designName: string;
  versions: VersionInfo[];
}): ReactElement {
  const router = useRouter();
  const baseVersion = useDesign((s) => s.baseVersion);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (version: number) => {
    const { dirty } = useDesign.getState();
    if (dirty.length && !window.confirm("Replace your unsaved edits with this version?")) return;
    startTransition(async () => {
      const result = await versionDataAction(designId, version);
      if (result.error !== undefined) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      try {
        useDesign.getState().replaceAll(result.data);
        setMessage({ tone: "ok", text: `Version ${version} is open as unsaved edits. Save to restore it.` });
      } catch {
        setMessage({ tone: "error", text: `Version ${version} no longer reads as a design.` });
      }
    });
  };

  const copy = (version: number) => {
    const name = window.prompt("Name the new design", `${designName} (from version ${version})`);
    if (!name) return;
    startTransition(async () => {
      const result = await createDesignAction(name, { id: designId, version });
      if (result.error !== undefined) setMessage({ tone: "error", text: result.error });
      else router.push(designHref(result.id));
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.pageHead}>
          <div>
            <h2 className={styles.pageTitle}>Versions</h2>
            <p className={styles.pageText}>
              Every save is a new version. Open an older one to restore it, or start a new design from it.
            </p>
          </div>
          {message ? (
            <span className={styles.status} data-tone={message.tone}>
              {message.text}
            </span>
          ) : null}
        </div>
        <div className={`${styles.tableWrap} ${styles.section}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Version</th>
                <th>Note</th>
                <th style={{ width: 200 }}>Saved by</th>
                <th style={{ width: 180 }}>Saved</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.version} aria-selected={v.version === baseVersion}>
                  <td className={`${styles.mono} ${styles.strong}`}>
                    {v.version}
                    {v.version === baseVersion ? <span className={styles.small}> (editing)</span> : null}
                  </td>
                  <td>{v.note ?? <span className={styles.muted}>–</span>}</td>
                  <td className={styles.muted}>{v.createdBy ?? "–"}</td>
                  <td className={styles.muted}>{when(v.createdAt)}</td>
                  <td className={styles.num}>
                    {v.version !== baseVersion ? (
                      <button type="button" className={styles.rowButton} disabled={pending} onClick={() => open(v.version)}>
                        Open
                      </button>
                    ) : null}
                    <button type="button" className={styles.rowButton} disabled={pending} onClick={() => copy(v.version)}>
                      New design from it
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

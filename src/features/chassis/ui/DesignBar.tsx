"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type ReactElement } from "react";
import { renameDesignAction, saveDesignAction } from "../actions";
import { usd } from "../model/format";
import { useDesign } from "../store";
import { CHASSIS_HREF, sheetHref, viewHref, type OpenDesign } from "../types";
import styles from "../chassis.module.css";
import { useDrawingSet } from "./DesignShell";
import { download, drawingSetName } from "./pdf";

export type DesignMeta = Pick<OpenDesign, "id" | "name" | "version" | "archived">;

/** The design's data as a JSON file, e.g. "NIRA-Chassis-I-REV-30.json", for Import or a copy outside the portal. */
function exportJson(): void {
  const { data } = useDesign.getState();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  download(blob, drawingSetName(data).replace(/\.pdf$/, ".json"));
}

function Title({ design }: { design: DesignMeta }): ReactElement {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{design.name}</h1>
        {design.archived ? (
          <span className={styles.badge} data-status="warn">
            Archived
          </span>
        ) : null}
        <button type="button" className={styles.rowButton} onClick={() => setEditing(true)} title="Rename the design">
          Rename
        </button>
      </div>
    );
  }

  return (
    <form
      className={styles.titleRow}
      onSubmit={(event) => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get("name") ?? "");
        startTransition(async () => {
          const result = await renameDesignAction(design.id, name);
          if (result.error) setError(result.error);
          else setEditing(false);
        });
      }}
    >
      <input
        name="name"
        className={styles.cell}
        defaultValue={design.name}
        aria-label="Design name"
        maxLength={120}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
        }}
      />
      <button type="submit" className={styles.button} disabled={pending}>
        Rename
      </button>
      <button type="button" className={styles.rowButton} onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error ? <span className={styles.status} data-tone="error">{error}</span> : null}
    </form>
  );
}

function SaveStatus(): ReactElement | null {
  const save = useDesign((s) => s.save);
  const dirty = useDesign((s) => s.dirty);
  if (save.status === "saving") return <span className={styles.status}>Saving…</span>;
  if (save.status === "error") {
    return (
      <span className={styles.status} data-tone="error">
        {save.message}
      </span>
    );
  }
  if (save.status === "conflict") {
    return (
      <span className={styles.status} data-tone="error">
        Version {save.latest} was saved by someone else while you edited.
      </span>
    );
  }
  if (dirty.length) return <span className={styles.draft}>Unsaved edits: {dirty.join(", ")}</span>;
  if (save.status === "saved") {
    return (
      <span className={styles.status} data-tone="ok">
        Saved as version {save.version}
      </span>
    );
  }
  return null;
}

/** The open design's name, figures and actions: undo, discard, save as the next version, export and import. */
export function DesignBar({ design }: { design: DesignMeta }): ReactElement {
  const project = useDesign((s) => s.data.project);
  const total = useDesign((s) => s.derived.bom.total);
  const checks = useDesign((s) => s.derived.checks);
  const dirty = useDesign((s) => s.dirty.length > 0);
  const undoCount = useDesign((s) => s.undoStack.length);
  const baseVersion = useDesign((s) => s.baseVersion);
  const save = useDesign((s) => s.save);
  const [note, setNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { render, progress } = useDrawingSet();

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const conflict = save.status === "conflict";
  const saving = save.status === "saving";

  const commit = async (force: boolean) => {
    const { designId, data, setSave, saved } = useDesign.getState();
    if (!designId) return;
    setSave({ status: "saving" });
    try {
      const result = await saveDesignAction(designId, baseVersion, data, note, force);
      if (result.error === undefined) {
        saved(result.version);
        setNote("");
      } else if (result.latest) {
        setSave({ status: "conflict", latest: result.latest });
      } else {
        setSave({ status: "error", message: result.error });
      }
    } catch {
      setSave({ status: "error", message: "Couldn't reach the server. Your edits are kept here; try again." });
    }
  };

  const discard = () => {
    if (window.confirm("Discard your unsaved edits and go back to the latest saved version?")) {
      useDesign.getState().discard();
    }
  };

  const exportPdf = async () => {
    try {
      const blob = await render();
      download(blob, drawingSetName(useDesign.getState().data));
    } catch (error) {
      useDesign.getState().setSave({ status: "error", message: `PDF export failed: ${String(error)}` });
    }
  };

  return (
    <header className={styles.bar}>
      <div className={styles.titleGroup}>
        <Title design={design} />
        <span className={styles.meta}>
          <Link href={CHASSIS_HREF} className={styles.metaLink}>
            Designs
          </Link>{" "}
          · Version {baseVersion} · {project.name} REV {project.revision} · {project.date} · {project.status}
        </span>
      </div>

      <div className={styles.actions}>
        <Link href={sheetHref(design.id, "G-601")} className={styles.figure} title="BOM total; opens the cost sheet">
          {usd(total)}
        </Link>
        <Link
          href={viewHref(design.id, "checks")}
          className={styles.badge}
          data-status={fails ? "fail" : warns ? "warn" : "pass"}
        >
          {fails ? `${fails} failing` : "All checks pass"}
          {warns ? ` · ${warns} warn` : ""}
        </Link>

        <span className={styles.divider} />

        <SaveStatus />
        {progress ? <span className={styles.progress}>{progress}</span> : null}

        <button type="button" className={styles.button} onClick={() => useDesign.getState().undo()} disabled={!undoCount}>
          Undo
        </button>
        <button type="button" className={styles.button} onClick={discard} disabled={!dirty && !conflict}>
          Discard
        </button>
        {dirty ? (
          <input
            className={styles.noteInput}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !saving) void commit(false);
            }}
            placeholder="What changed? (optional)"
            aria-label="Version note"
            maxLength={2000}
          />
        ) : null}
        {conflict ? (
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={() => void commit(true)}
            disabled={!dirty || saving}
            title={`Save your edits as the next version, after version ${save.latest}`}
          >
            Save over it
          </button>
        ) : (
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={() => void commit(false)}
            disabled={!dirty || saving}
            title="Save the edits as the design's next version"
          >
            Save
          </button>
        )}

        <span className={styles.divider} />

        <button
          type="button"
          className={styles.button}
          onClick={() => void exportPdf()}
          disabled={progress !== null}
          title="Download every sheet as one A3 PDF, unsaved edits included"
        >
          PDF
        </button>
        <button type="button" className={styles.button} onClick={exportJson} title="Download the design's data as JSON">
          JSON
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => fileInput.current?.click()}
          title="Replace the design's data with a JSON export; save to keep it"
        >
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              useDesign.getState().replaceAll(JSON.parse(await file.text()));
            } catch {
              useDesign
                .getState()
                .setSave({ status: "error", message: `${file.name} isn't a chassis design export.` });
            }
          }}
        />
      </div>
    </header>
  );
}

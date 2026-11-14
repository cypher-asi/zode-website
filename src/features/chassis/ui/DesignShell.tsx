"use client";

import { createContext, useContext, useEffect, type ReactElement, type ReactNode } from "react";
import type { DesignData } from "../model/schema";
import { useDesign } from "../store";
import styles from "../chassis.module.css";
import { DesignBar, type DesignMeta } from "./DesignBar";
import { Inspector } from "./Inspector";
import { useDrawingSetPdf } from "./pdf";
import { SheetNav } from "./SheetNav";

type DrawingSet = Pick<ReturnType<typeof useDrawingSetPdf>, "render" | "progress">;

const DrawingSetContext = createContext<DrawingSet | null>(null);

/** The open design's drawing set as a PDF, drawn from what's on screen, unsaved edits included. */
export function useDrawingSet(): DrawingSet {
  const value = useContext(DrawingSetContext);
  if (!value) throw new Error("useDrawingSet must be used inside DesignShell");
  return value;
}

/**
 * An open design: its bar over the sheet list, the sheet or data page, and
 * the inspector. Loads the server's latest version into the editor, or this
 * browser's unsaved draft of it, before drawing anything.
 */
export function DesignShell({
  design,
  data,
  children,
}: {
  design: DesignMeta;
  data: DesignData;
  children: ReactNode;
}): ReactElement {
  const loadedId = useDesign((s) => s.designId);
  const { render, stage, progress } = useDrawingSetPdf();

  useEffect(() => {
    const state = useDesign.getState();
    if (state.designId !== design.id) {
      state.load({ designId: design.id, version: design.version, data });
    } else if (design.version > state.latestVersion) {
      // Someone saved: show it, unless there are edits here, which now need saving over it.
      if (state.dirty.length) {
        useDesign.setState({ latestVersion: design.version, base: data, save: { status: "conflict", latest: design.version } });
      } else {
        state.load({ designId: design.id, version: design.version, data });
      }
    }
  }, [design.id, design.version, data]);

  if (loadedId !== design.id) {
    return <div className={styles.sceneLoading}>Opening {design.name}…</div>;
  }

  return (
    <DrawingSetContext value={{ render, progress }}>
      <div className={styles.app}>
        <DesignBar design={design} />
        <div className={styles.body}>
          <SheetNav designId={design.id} />
          <main className={styles.main}>{children}</main>
          <aside className={styles.inspector} aria-label="Inspector">
            <Inspector />
          </aside>
        </div>
      </div>
      {stage}
    </DrawingSetContext>
  );
}

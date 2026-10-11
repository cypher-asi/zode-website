"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { fetchFile, type ViewerProps } from "./types";
import { fitWidth, usePanelSize } from "./useFit";
import styles from "../Viewer.module.css";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

/** PowerPoint decks drawn in the browser by pptx-preview, slides stacked top to bottom. Approximate. */
export default function PptxViewer({ url, zoom, onFitScale }: ViewerProps): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panel = usePanelSize(panelRef);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const content = contentRef.current;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const [{ init }, buffer] = await Promise.all([import("pptx-preview"), fetchFile(url, controller.signal)]);
        if (!content || controller.signal.aborted) return;
        const previewer = init(content, { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, mode: "list" });
        destroy = () => previewer.destroy();
        await previewer.preview(buffer);
        if (!controller.signal.aborted) setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    })();
    return () => {
      controller.abort();
      destroy?.();
      if (content) content.replaceChildren();
    };
  }, [url]);

  const fit = fitWidth(panel.width, SLIDE_WIDTH, 1.5);
  useEffect(() => onFitScale(fit), [fit, onFitScale]);
  const scale = zoom === "fit" ? fit : zoom;

  return (
    <div ref={panelRef} className={styles.document} onContextMenu={(event) => event.preventDefault()}>
      {state === "loading" ? <div className={styles.status}>Rendering slides…</div> : null}
      {state === "error" ? (
        <div className={styles.status}>This presentation couldn&apos;t be previewed. Download it to open it in PowerPoint.</div>
      ) : null}
      <div
        ref={contentRef}
        className={styles.pptx}
        style={{ zoom: scale, width: SLIDE_WIDTH, visibility: state === "ready" ? "visible" : "hidden" }}
      />
    </div>
  );
}

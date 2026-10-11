"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { blockUnsafeLinks, defuseLinks } from "./safeLinks";
import { fetchFile, type ViewerProps } from "./types";
import { fitWidth, usePanelSize } from "./useFit";
import styles from "../Viewer.module.css";

/** Word documents laid out in the browser by docx-preview: close to Word, not identical. */
export default function DocxViewer({ url, zoom, onFitScale }: ViewerProps): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panel = usePanelSize(panelRef);
  const [pageWidth, setPageWidth] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const content = contentRef.current;
    (async () => {
      try {
        const [{ renderAsync }, buffer] = await Promise.all([import("docx-preview"), fetchFile(url, controller.signal)]);
        if (!content || controller.signal.aborted) return;
        await renderAsync(buffer, content, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          // The CSP allows data: images but not blob: ones.
          useBase64URL: true,
          experimental: true,
        });
        if (controller.signal.aborted) return;
        defuseLinks(content);
        const first = content.querySelector<HTMLElement>("section.docx");
        setPageWidth(first ? first.offsetWidth : content.scrollWidth);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    })();
    return () => {
      controller.abort();
      if (content) content.replaceChildren();
    };
  }, [url]);

  const fit = fitWidth(panel.width, pageWidth, 1.5);
  useEffect(() => onFitScale(fit), [fit, onFitScale]);
  const scale = zoom === "fit" ? fit : zoom;

  return (
    <div
      ref={panelRef}
      className={styles.document}
      onClickCapture={blockUnsafeLinks}
      onContextMenu={(event) => event.preventDefault()}
    >
      {state === "loading" ? <div className={styles.status}>Rendering document…</div> : null}
      {state === "error" ? (
        <div className={styles.status}>This document couldn&apos;t be previewed. Download it to open it in Word.</div>
      ) : null}
      {/* Laid out while loading (just not shown), so the page width can be measured for "fit". */}
      <div
        ref={contentRef}
        className={styles.docx}
        style={{ zoom: scale, visibility: state === "ready" ? "visible" : "hidden" }}
      />
    </div>
  );
}

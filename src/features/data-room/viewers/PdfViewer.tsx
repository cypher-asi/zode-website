"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ViewerProps } from "./types";
import styles from "../Viewer.module.css";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | undefined;

/**
 * pdf.js and one shared worker, loaded on first use. The legacy build, because
 * the modern one calls APIs (Uint8Array#toHex and others) that browsers only
 * shipped recently, and fails every document without them.
 */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
    return pdfjs;
  });
  return pdfjsPromise;
}

const PAGE_GAP = 16;
const PADDING = 24;
/** Canvas pixels per page, so deep zoom stays within what browsers will allocate. */
const MAX_CANVAS_PIXELS = 16_777_216;

interface PageSize {
  width: number;
  height: number;
}

export default function PdfViewer({ url, zoom, onFitScale }: Omit<ViewerProps, "file">): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        // One whole-file request, so the view is audited once. The CSP doesn't allow
        // compiling WebAssembly, so pdf.js keeps to its JavaScript decoders.
        const task = pdfjs.getDocument({
          url,
          useWasm: false,
          disableRange: true,
          disableStream: true,
          disableAutoFetch: true,
        });
        destroy = () => void task.destroy();
        const loaded = await task.promise;
        const pages = await Promise.all(
          Array.from({ length: loaded.numPages }, async (_, i) => {
            const viewport = (await loaded.getPage(i + 1)).getViewport({ scale: 1 });
            return { width: viewport.width, height: viewport.height };
          }),
        );
        if (cancelled) return;
        setDoc(loaded);
        setSizes(pages);
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name;
        setError(
          name === "PasswordException"
            ? "This PDF is password protected. Download it to open it."
            : name === "InvalidPDFException"
              ? "This file isn't a valid PDF."
              : "This PDF couldn't be loaded.",
        );
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setPanelWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const widest = sizes.reduce((max, size) => Math.max(max, size.width), 0);
  const fit = panelWidth && widest ? Math.max(0.1, (panelWidth - PADDING * 2) / widest) : 1;
  const scale = zoom === "fit" ? fit : zoom;

  useEffect(() => onFitScale(fit), [fit, onFitScale]);

  // Keep the same spot in the document under the viewport as the scale changes.
  const lastScale = useRef(scale);
  useLayoutEffect(() => {
    const container = containerRef.current;
    const previous = lastScale.current;
    lastScale.current = scale;
    if (!container || previous === scale) return;
    const ratio = scale / previous;
    container.scrollTop = (container.scrollTop + container.clientHeight / 2) * ratio - container.clientHeight / 2;
    container.scrollLeft = (container.scrollLeft + container.clientWidth / 2) * ratio - container.clientWidth / 2;
  }, [scale]);

  const onScroll = () => {
    const container = containerRef.current;
    if (!container || !sizes.length) return;
    const middle = container.scrollTop + container.clientHeight / 3;
    let top = PADDING;
    for (let i = 0; i < sizes.length; i += 1) {
      top += sizes[i].height * scale + PAGE_GAP;
      if (top > middle) {
        setPage(i + 1);
        return;
      }
    }
    setPage(sizes.length);
  };

  return (
    <div ref={containerRef} className={styles.pdf} onScroll={onScroll} onContextMenu={(event) => event.preventDefault()}>
      {error ? <div className={styles.status}>{error}</div> : null}
      {!error && !doc ? <div className={styles.status}>Loading PDF…</div> : null}
      {doc ? (
        <>
          <div className={styles.pdfPages} style={{ padding: PADDING, gap: PAGE_GAP }}>
            {sizes.map((size, i) => (
              <PdfPage key={i} doc={doc} number={i + 1} size={size} scale={scale} rootRef={containerRef} />
            ))}
          </div>
          <div className={styles.pageBadge} aria-live="polite">
            Page {page} of {sizes.length}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PdfPage({
  doc,
  number,
  size,
  scale,
  rootRef,
}: {
  doc: PDFDocumentProxy;
  number: number;
  size: PageSize;
  scale: number;
  rootRef: RefObject<HTMLDivElement | null>;
}): ReactElement {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: rootRef.current,
      rootMargin: "100% 0px",
    });
    observer.observe(holder);
    return () => observer.disconnect();
  }, [rootRef]);

  useEffect(() => {
    if (!visible) return;
    let task: RenderTask | undefined;
    let cancelled = false;
    // A short pause lets a burst of zoom steps settle into one render.
    const timer = window.setTimeout(async () => {
      const pdfPage = await doc.getPage(number);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const viewport = pdfPage.getViewport({ scale });
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, viewport.width * viewport.height)),
      );
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.floor(viewport.width * ratio);
      offscreen.height = Math.floor(viewport.height * ratio);
      task = pdfPage.render({
        canvas: offscreen,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      try {
        await task.promise;
      } catch {
        return;
      }
      if (cancelled) return;
      // Swap in the finished render, so the old one stays up (scaled) while the new one draws.
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [visible, scale, doc, number]);

  return (
    <div
      ref={holderRef}
      className={styles.pdfPage}
      style={{ width: size.width * scale, height: size.height * scale }}
      aria-label={`Page ${number}`}
      role="img"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

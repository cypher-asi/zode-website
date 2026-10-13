"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import { fileKind, formatBytes, typeLabel, type FileKind } from "./fileKinds";
import { FileGlyph, Icon } from "./icons";
import type { RoomFile } from "./types";
import type { ViewerProps, Zoom } from "./viewers/types";
import styles from "./Viewer.module.css";
import ui from "./ui.module.css";

const loading = () => <div className={styles.status}>Loading preview…</div>;

/** Each previewer, and its library, loads only when a file of that kind is opened. */
const VIEWERS: Partial<Record<FileKind, ComponentType<ViewerProps>>> = {
  pdf: dynamic(() => import("./viewers/PdfViewer"), { ssr: false, loading }),
  image: dynamic(() => import("./viewers/ImageViewer"), { ssr: false, loading }),
  video: dynamic(() => import("./viewers/MediaViewer"), { ssr: false, loading }),
  audio: dynamic(() => import("./viewers/MediaViewer"), { ssr: false, loading }),
  text: dynamic(() => import("./viewers/TextViewer"), { ssr: false, loading }),
  csv: dynamic(() => import("./viewers/TextViewer"), { ssr: false, loading }),
  docx: dynamic(() => import("./viewers/DocxViewer"), { ssr: false, loading }),
  xlsx: dynamic(() => import("./viewers/SheetViewer"), { ssr: false, loading }),
  pptx: dynamic(() => import("./viewers/PptxViewer"), { ssr: false, loading }),
};

const ZOOMABLE = new Set<FileKind>(["pdf", "image", "text", "csv", "docx", "xlsx", "pptx"]);

const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

const uploaded = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export interface RoomSummary {
  /** The rendered summary; its source links carry `data-file-id`. */
  content: ReactNode;
}

/**
 * The room's diligence summary in the viewer's place. Plain clicks on a
 * source link open that file here instead of navigating.
 */
export function SummaryPanel({
  summary,
  onBack,
  onOpenFile,
}: {
  summary: RoomSummary;
  onBack: () => void;
  onOpenFile: (fileId: string) => void;
}): ReactElement {
  const scrollId = useId();
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLElement>("a[data-file-id]");
    if (!link?.dataset.fileId) return;
    event.preventDefault();
    onOpenFile(link.dataset.fileId);
  };

  return (
    <div className={styles.viewer}>
      <header className={`${styles.header} ${styles.summaryHeader}`}>
        <button type="button" className={`${ui.iconButton} ${styles.back}`} onClick={onBack} aria-label="Back to files">
          <Icon name="back" />
        </button>
      </header>
      <div className={styles.summaryFrame}>
        <div id={scrollId} className={styles.summary} onClickCapture={onClick}>
          {summary.content}
        </div>
        <OverlayScrollbar targetId={scrollId} />
      </div>
    </div>
  );
}

export function Viewer({ roomId, file, onBack }: { roomId: string; file: RoomFile | null; onBack: () => void }): ReactElement {
  if (!file) {
    return (
      <div className={styles.empty}>
        <Icon name="file" />
        <p>Select a file to preview it here.</p>
      </div>
    );
  }
  return <FileViewer roomId={roomId} file={file} onBack={onBack} />;
}

function FileViewer({ roomId, file, onBack }: { roomId: string; file: RoomFile; onBack: () => void }): ReactElement {
  const kind = fileKind(file.name);
  const Preview = VIEWERS[kind];
  const zoomable = Boolean(Preview) && ZOOMABLE.has(kind);
  const url = `/api/data-rooms/${roomId}/files/${file.id}`;

  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fitScale, setFitScale] = useState(1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scale = zoom === "fit" ? fitScale : zoom;

  const step = useCallback(
    (direction: 1 | -1) =>
      setZoom((current) => {
        const from = current === "fit" ? fitScale : current;
        const next =
          direction > 0 ? STEPS.find((s) => s > from + 0.001) : [...STEPS].reverse().find((s) => s < from - 0.001);
        return next ?? from;
      }),
    [fitScale],
  );

  // Ctrl/Cmd + wheel (and trackpad pinch, which browsers report the same way) zooms the preview, not the page.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !zoomable) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      step(event.deltaY < 0 ? 1 : -1);
    };
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, [step, zoomable]);

  return (
    <div
      className={styles.viewer}
      onKeyDown={(event) => {
        if (!zoomable || (event.target as HTMLElement).closest("input, textarea, select")) return;
        if (event.key === "+" || event.key === "=") step(1);
        else if (event.key === "-") step(-1);
        else if (event.key === "0") setZoom("fit");
        else return;
        event.preventDefault();
      }}
    >
      <header className={styles.header}>
        <button type="button" className={`${ui.iconButton} ${styles.back}`} onClick={onBack} aria-label="Back to files">
          <Icon name="back" />
        </button>
        <FileGlyph kind={kind} className={styles.glyph} />
        <div className={styles.titles}>
          <h2 className={styles.name} title={file.name}>
            {file.name}
          </h2>
          <p className={styles.meta}>
            {typeLabel(file.name)} · {formatBytes(file.sizeBytes)} · Added {uploaded.format(new Date(file.createdAt))}
          </p>
        </div>
        {zoomable ? (
          <div className={styles.zoom} role="group" aria-label="Zoom">
            <button type="button" className={ui.iconButton} onClick={() => step(-1)} aria-label="Zoom out" title="Zoom out (−)">
              <Icon name="zoomOut" />
            </button>
            <button
              type="button"
              className={styles.zoomValue}
              onClick={() => setZoom(1)}
              title="Actual size"
              aria-label={`Zoom ${Math.round(scale * 100)} percent. Reset to 100 percent`}
            >
              {Math.round(scale * 100)}%
            </button>
            <button type="button" className={ui.iconButton} onClick={() => step(1)} aria-label="Zoom in" title="Zoom in (+)">
              <Icon name="zoomIn" />
            </button>
            <button
              type="button"
              className={ui.iconButton}
              onClick={() => setZoom("fit")}
              aria-label="Fit to panel"
              aria-pressed={zoom === "fit"}
              title="Fit (0)"
            >
              <Icon name="fit" />
            </button>
          </div>
        ) : null}
        <a className={ui.button} href={`${url}?download=1`} download={file.name}>
          <Icon name="download" />
          <span className={styles.downloadLabel}>Download</span>
        </a>
      </header>
      <div ref={bodyRef} className={styles.body} tabIndex={-1}>
        {Preview ? (
          <Preview url={url} file={file} zoom={zoom} onFitScale={setFitScale} />
        ) : (
          <div className={styles.unsupported}>
            <FileGlyph kind={kind} className={styles.bigGlyph} />
            <p className={styles.unsupportedName}>{file.name}</p>
            <p>Preview isn&apos;t available for {typeLabel(file.name)} files. Download it to open it on your device.</p>
            <a className={ui.primary} href={`${url}?download=1`} download={file.name}>
              <Icon name="download" />
              Download {formatBytes(file.sizeBytes)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

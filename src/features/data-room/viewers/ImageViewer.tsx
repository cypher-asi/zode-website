"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { Scrollbars } from "./Scrollbars";
import type { ViewerProps } from "./types";
import { usePanelSize } from "./useFit";
import styles from "../Viewer.module.css";

/** An image, fit to the panel (never enlarged) or at a fixed zoom, with drag to pan. */
export default function ImageViewer({ url, file, zoom, onFitScale }: ViewerProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollId = useId();
  const panel = usePanelSize(containerRef);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState(false);

  const fit =
    natural && panel.width && panel.height
      ? Math.min(1, (panel.width - 32) / natural.width, (panel.height - 32) / natural.height)
      : 1;
  const scale = zoom === "fit" ? fit : zoom;

  useEffect(() => onFitScale(fit), [fit, onFitScale]);

  const lastScale = useRef(scale);
  useLayoutEffect(() => {
    const container = containerRef.current;
    const previous = lastScale.current;
    lastScale.current = scale;
    if (!container || previous === scale) return;
    const ratio = scale / previous;
    container.scrollLeft = (container.scrollLeft + container.clientWidth / 2) * ratio - container.clientWidth / 2;
    container.scrollTop = (container.scrollTop + container.clientHeight / 2) * ratio - container.clientHeight / 2;
  }, [scale]);

  return (
    <>
      <div
        ref={containerRef}
        id={scrollId}
        className={styles.image}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          const container = containerRef.current;
          if (!container || event.button !== 0) return;
          if (container.scrollWidth <= container.clientWidth && container.scrollHeight <= container.clientHeight) return;
          const start = { x: event.clientX, y: event.clientY, left: container.scrollLeft, top: container.scrollTop };
          container.setPointerCapture(event.pointerId);
          container.dataset.panning = "";
          const move = (e: PointerEvent) => {
            container.scrollLeft = start.left - (e.clientX - start.x);
            container.scrollTop = start.top - (e.clientY - start.y);
          };
          const end = () => {
            delete container.dataset.panning;
            container.removeEventListener("pointermove", move);
            container.removeEventListener("pointerup", end);
            container.removeEventListener("pointercancel", end);
          };
          container.addEventListener("pointermove", move);
          container.addEventListener("pointerup", end);
          container.addEventListener("pointercancel", end);
        }}
      >
        {error ? <div className={styles.status}>This image couldn&apos;t be displayed.</div> : null}
        <div className={styles.imageStage}>
          {/* eslint-disable-next-line @next/next/no-img-element -- access-checked bytes, not an optimizable asset */}
          <img
            src={url}
            alt={file.name}
            draggable={false}
            onLoad={(event) =>
              setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
            }
            onError={() => setError(true)}
            style={
              natural
                ? { width: natural.width * scale, height: natural.height * scale }
                : { maxWidth: "100%", maxHeight: "100%", visibility: "hidden" }
            }
          />
        </div>
      </div>
      <Scrollbars targetId={scrollId} />
    </>
  );
}

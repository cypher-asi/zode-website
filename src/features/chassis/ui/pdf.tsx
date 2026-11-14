"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { PAPER } from "../drawing/SheetFrame";
import type { DesignData } from "../model/schema";
import { SHEET_RENDERERS } from "../sheets/registry";
import { useDesign } from "../store";
import styles from "../chassis.module.css";
import { SheetPaper } from "./SheetView";

/** Screen pixels per paper mm for the 3D views' images: about 200 dpi on the printed sheet. */
const SCENE_PX_PER_MM = 8;
/** How long a 3D view gets to draw before it's captured. */
const SCENE_TIMEOUT_MS = 10_000;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** A safe file name for the design's drawing set, e.g. "NIRA-Chassis-I-REV-30.pdf". */
export function drawingSetName(data: DesignData): string {
  const base = `${data.project.name} REV ${data.project.revision}`
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "drawing-set"}.pdf`;
}

/** Whether the WebGL canvas has drawn anything yet; its background is transparent until it does. */
function hasDrawn(canvas: HTMLCanvasElement): boolean {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 32;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return true;
  ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
  const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  return false;
}

/** Waits for the stage's WebGL canvas to load its scene and draw it, then reads it as a PNG. */
async function captureScene(host: HTMLElement): Promise<string | null> {
  const started = performance.now();
  const waiting = () => performance.now() - started < SCENE_TIMEOUT_MS;
  let canvas: HTMLCanvasElement | null = null;
  while (!canvas && waiting()) {
    canvas = host.querySelector("canvas");
    if (!canvas) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!canvas) return null;
  await nextFrame();
  while (!hasDrawn(canvas) && waiting()) await nextFrame();
  for (let i = 0; i < 3; i++) await nextFrame();
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

interface Job {
  resolve: (blob: Blob) => void;
  reject: (error: unknown) => void;
}

/**
 * The open design's whole drawing set as one A3 landscape PDF: every sheet
 * drawn as vector paths and text, the 3D views as images where they sit.
 * `render` draws the sheets off-screen in `stage`, which must be mounted.
 */
export function useDrawingSetPdf(): {
  render: () => Promise<Blob>;
  stage: ReactElement | null;
  progress: string | null;
} {
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);

  const render = useCallback(
    () =>
      new Promise<Blob>((resolve, reject) => {
        const { select, setHover } = useDesign.getState();
        select(null);
        setHover(null);
        setProgress("Drawing sheets…");
        setJob({ resolve, reject });
      }),
    [],
  );

  useEffect(() => {
    if (!job || !host.current) return;
    const stage = host.current;
    let cancelled = false;
    (async () => {
      const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
      const { data } = useDesign.getState();
      const sheets = data.sheets.sheets;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
      doc.setProperties({
        title: `${data.project.name}: ${data.project.subtitle}`,
        subject: `${data.project.status}, REV ${data.project.revision}, ${data.project.date}`,
        author: "ZODE",
        creator: "ZODE portal, Chassis",
      });
      await nextFrame();
      for (let i = 0; i < sheets.length; i++) {
        if (cancelled) return;
        setProgress(`Sheet ${i + 1} of ${sheets.length}: ${sheets[i].id}`);
        if (i > 0) doc.addPage("a3", "landscape");
        const page = stage.querySelector<HTMLElement>(`[data-sheet="${i}"]`);
        const svg = page?.querySelector("svg");
        if (svg) await svg2pdf(svg, doc, { x: 0, y: 0, width: PAPER.w, height: PAPER.h });
        const rect = SHEET_RENDERERS[sheets[i].renderer]?.scene?.rect;
        const sceneHost = page?.querySelector<HTMLElement>("[data-scene]");
        if (rect && sceneHost) {
          const png = await captureScene(sceneHost);
          if (png) doc.addImage(png, "PNG", rect.x, rect.y, rect.w, rect.h, undefined, "FAST");
        }
      }
      job.resolve(doc.output("blob"));
    })()
      .catch((error) => job.reject(error))
      .finally(() => {
        if (cancelled) return;
        setJob(null);
        setProgress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [job]);

  const stage = job ? <ExportStage ref={host} /> : null;
  return { render, stage, progress };
}

function ExportStage({ ref }: { ref: React.Ref<HTMLDivElement> }): ReactElement {
  const sheets = useDesign((s) => s.data.sheets.sheets);
  return (
    <div ref={ref} className={styles.exportStage} aria-hidden>
      {sheets.map((sheet, i) => {
        const scene = SHEET_RENDERERS[sheet.renderer]?.scene;
        return (
          <div key={sheet.id} data-sheet={i}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${PAPER.w} ${PAPER.h}`}
              width={PAPER.w * 2}
              height={PAPER.h * 2}
            >
              <SheetPaper index={i} />
            </svg>
            {scene ? (
              <div
                data-scene
                style={{
                  position: "relative",
                  width: scene.rect.w * SCENE_PX_PER_MM,
                  height: scene.rect.h * SCENE_PX_PER_MM,
                }}
              >
                <scene.Scene />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Saves `blob` as a download named `name`. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

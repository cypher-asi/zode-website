"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactElement } from "react";
import { SheetFrame } from "../drawing/SheetFrame";
import { MissingRenderer, SHEET_RENDERERS } from "../sheets/registry";
import { useDesign } from "../store";
import { sheetHref } from "../types";
import { SheetViewer } from "./SheetViewer";

/** Sheet `index` of the open design on its paper, without the 3D views that float over two of them. */
export function SheetPaper({ index }: { index: number }): ReactElement | null {
  const sheets = useDesign((s) => s.data.sheets.sheets);
  const project = useDesign((s) => s.data.project);
  const sheet = sheets[index];
  if (!sheet) return null;
  const def = SHEET_RENDERERS[sheet.renderer];
  return (
    <SheetFrame project={project} sheet={sheet} index={index} total={sheets.length}>
      {def ? <def.Component /> : <MissingRenderer name={sheet.renderer} />}
    </SheetFrame>
  );
}

/** One sheet of the design, zoomable, with its 3D view over it when it has one. */
export function SheetView({ designId, sheetId }: { designId: string; sheetId: string }): ReactElement | null {
  const router = useRouter();
  const sheets = useDesign((s) => s.data.sheets.sheets);
  const index = sheets.findIndex((sheet) => sheet.id === sheetId);
  const first = sheets[0]?.id;

  useEffect(() => {
    if (index < 0 && first) router.replace(sheetHref(designId, first));
  }, [designId, first, index, router]);

  if (index < 0) return null;
  const def = SHEET_RENDERERS[sheets[index].renderer];
  const scene = def?.scene;

  return (
    <SheetViewer
      key={sheetId}
      overlay={
        scene
          ? {
              rect: scene.rect,
              node: <scene.Scene />,
            }
          : undefined
      }
    >
      <SheetPaper index={index} />
    </SheetViewer>
  );
}
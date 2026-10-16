"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";
import viewer from "@/features/data-room/Viewer.module.css";
import styles from "./presentations.module.css";

const PdfViewer = dynamic(() => import("@/features/data-room/viewers/PdfViewer"), {
  ssr: false,
  loading: () => <div className={viewer.status}>Loading preview…</div>,
});

const ignoreFit = () => {};

/** The saved presentation's PDF, drawn by the data room's viewer since the site's CSP forbids framing it. */
export function PresentationPreview({ url }: { url: string }): ReactElement {
  return (
    <div className={styles.previewFrame}>
      <PdfViewer url={url} zoom="fit" onFitScale={ignoreFit} />
    </div>
  );
}

"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";
import viewer from "@/features/data-room/Viewer.module.css";
import styles from "./teasers.module.css";

const PdfViewer = dynamic(() => import("@/features/data-room/viewers/PdfViewer"), {
  ssr: false,
  loading: () => <div className={viewer.status}>Loading preview…</div>,
});

const ignoreFit = () => {};

/** The saved teaser's PDF, drawn by the data room's viewer since the site's CSP forbids framing it. */
export function TeaserPreview({ url }: { url: string }): ReactElement {
  return (
    <div className={styles.previewFrame}>
      <PdfViewer url={url} zoom="fit" onFitScale={ignoreFit} />
    </div>
  );
}

"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";
import viewer from "@/features/data-room/Viewer.module.css";
import styles from "./shared.module.css";

const PdfViewer = dynamic(() => import("@/features/data-room/viewers/PdfViewer"), {
  ssr: false,
  loading: () => <div className={viewer.status}>Loading PDF…</div>,
});

const ignoreFit = () => {};

/** A shared deployment's PDF, drawn by the data room's viewer since the site's CSP forbids framing it. */
export function SharedPdf({ url }: { url: string }): ReactElement {
  return (
    <div className={styles.frame}>
      <PdfViewer url={url} zoom="fit" onFitScale={ignoreFit} />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/features/data-room/icons";
import { PreviewFrame } from "@/features/data-room/Viewer";
import viewer from "@/features/data-room/Viewer.module.css";
import ui from "@/features/data-room/ui.module.css";
import styles from "./ContractViewer.module.css";

const PdfViewer = dynamic(() => import("@/features/data-room/viewers/PdfViewer"), {
  ssr: false,
  loading: () => <div className={viewer.status}>Loading preview…</div>,
});

export interface ContractPdf {
  /** The access-checked PDF route, e.g. `/api/contracts/{id}/pdf?doc={documentId}`. */
  url: string;
  title: string;
  meta: string;
}

/** A button that opens an executed agreement's PDF in a viewer, with a way to download it. */
export function OpenContract({
  pdf,
  className,
  children,
}: {
  pdf: ContractPdf;
  className: string;
  children: ReactNode;
}): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? <ContractViewer pdf={pdf} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** The PDF viewer in a modal <dialog>, which brings focus trapping and Escape to close. */
function ContractViewer({ pdf, onClose }: { pdf: ContractPdf; onClose: () => void }): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const download = `${pdf.url}${pdf.url.includes("?") ? "&" : "?"}download=1`;

  return (
    <dialog
      ref={ref}
      className={`${ui.dialog} ${styles.dialog}`}
      aria-label={pdf.title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <PreviewFrame
        name={pdf.title}
        meta={pdf.meta}
        kind="pdf"
        downloadUrl={download}
        zoomable
        trailing={
          <button type="button" className={ui.iconButton} onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        }
      >
        {(zoom, onFitScale) => <PdfViewer url={pdf.url} zoom={zoom} onFitScale={onFitScale} />}
      </PreviewFrame>
    </dialog>
  );
}

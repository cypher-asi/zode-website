"use client";

import { useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/features/data-room/icons";
import { PreviewFrame } from "@/features/data-room/Viewer";
import viewer from "@/features/data-room/Viewer.module.css";
import ui from "@/features/data-room/ui.module.css";
import { presentationFileName, presentationPdfPath } from "@/features/presentations/types";
import { teaserFileName, teaserPdfPath } from "@/features/teasers/types";
import { TabLink, useDeploymentTab } from "./DeploymentTabs";
import { formatDay } from "./format";
import styles from "./DocumentViewer.module.css";

const PdfViewer = dynamic(() => import("@/features/data-room/viewers/PdfViewer"), {
  ssr: false,
  loading: () => <div className={viewer.status}>Loading…</div>,
});

/** The documents written out from a deployment, each previewed on its own tab. */
const DOCS = {
  presentation: { label: "Presentation", fileName: presentationFileName, path: presentationPdfPath },
  teaser: { label: "Teaser", fileName: teaserFileName, path: teaserPdfPath },
} as const;

/**
 * One of a deployment's documents in the data room's PDF viewer, across the
 * page's column, with Download and a way back to the summary. The PDF is
 * rendered per request, so it's only fetched once its tab is first opened.
 */
export function DocumentViewer({
  doc,
  deployment,
  today,
}: {
  doc: keyof typeof DOCS;
  /** `name` is what the document's file is named after. */
  deployment: { id: string; name: string };
  today: string;
}): ReactElement {
  const { label, fileName, path } = DOCS[doc];
  const open = useDeploymentTab() === doc;
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);

  return (
    <div className={styles.frame}>
      <PreviewFrame
        name={fileName(deployment.name)}
        meta={`${label} · As of ${formatDay(today)}`}
        kind="pdf"
        downloadUrl={path(deployment.id, true)}
        downloadName={fileName(deployment.name)}
        zoomable
        trailing={
          <TabLink tab="summary" className={ui.iconButton} label="Close">
            <Icon name="close" />
          </TabLink>
        }
      >
        {(zoom, onFitScale) =>
          opened ? <PdfViewer url={path(deployment.id)} zoom={zoom} onFitScale={onFitScale} /> : null
        }
      </PreviewFrame>
    </div>
  );
}

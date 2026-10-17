"use client";

import { useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/features/data-room/icons";
import { PreviewFrame } from "@/features/data-room/Viewer";
import viewer from "@/features/data-room/Viewer.module.css";
import ui from "@/features/data-room/ui.module.css";
import { presentationFileName, presentationPdfPath } from "@/features/presentations/types";
import { TabLink, useDeploymentTab } from "./DeploymentTabs";
import { formatDay } from "./format";
import styles from "./PresentationViewer.module.css";

const PdfViewer = dynamic(() => import("@/features/data-room/viewers/PdfViewer"), {
  ssr: false,
  loading: () => <div className={viewer.status}>Loading presentation…</div>,
});

/**
 * A deployment's presentation in the data room's PDF viewer, across the
 * page's column, with Download and a way back to the summary. The PDF is
 * rendered per request, so it's only fetched once the tab is first opened.
 */
export function PresentationViewer({
  deployment,
  today,
}: {
  deployment: { id: string; name: string };
  today: string;
}): ReactElement {
  const open = useDeploymentTab() === "presentation";
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);

  return (
    <div className={styles.frame}>
      <PreviewFrame
        name={presentationFileName(deployment.name)}
        meta={`Presentation · As of ${formatDay(today)}`}
        kind="pdf"
        downloadUrl={presentationPdfPath(deployment.id, true)}
        downloadName={presentationFileName(deployment.name)}
        zoomable
        trailing={
          <TabLink tab="summary" className={ui.iconButton} label="Close">
            <Icon name="close" />
          </TabLink>
        }
      >
        {(zoom, onFitScale) =>
          opened ? <PdfViewer url={presentationPdfPath(deployment.id)} zoom={zoom} onFitScale={onFitScale} /> : null
        }
      </PreviewFrame>
    </div>
  );
}

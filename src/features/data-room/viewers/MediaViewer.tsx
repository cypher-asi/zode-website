"use client";

import { useState, type ReactElement } from "react";
import { fileKind } from "../fileKinds";
import type { ViewerProps } from "./types";
import styles from "../Viewer.module.css";

/** Native players, streamed with range requests so seeking doesn't download the whole file. */
export default function MediaViewer({ url, file }: ViewerProps): ReactElement {
  const [error, setError] = useState(false);
  if (error) {
    return <div className={styles.status}>This browser can&apos;t play this file. Download it to open it on your device.</div>;
  }
  return (
    <div className={styles.media}>
      {fileKind(file.name) === "audio" ? (
        <audio src={url} controls preload="metadata" controlsList="nodownload" onError={() => setError(true)} />
      ) : (
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          controlsList="nodownload"
          disablePictureInPicture
          onError={() => setError(true)}
          onContextMenu={(event) => event.preventDefault()}
        />
      )}
    </div>
  );
}

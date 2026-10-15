"use client";

import type { ReactElement } from "react";
import { CabinArt } from "@/features/zode-drawings/CabinArt";

const noop = () => {};

/** The compute pod drawing, as on the deck's solution slide; nothing on the sheet reacts to its hotspots. */
export function PodDrawing(): ReactElement {
  return <CabinArt pod="compute" active={null} onActive={noop} />;
}

export function PrintButton({ className }: { className: string }): ReactElement {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      Download PDF
    </button>
  );
}

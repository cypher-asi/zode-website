import type { ReactElement } from "react";

export type UnitIconId = "gpu" | "power" | "fabric" | "storage" | "rate" | "revenue";

/* Drawn on a 24px grid inside a 2px margin, as the portal's icons, in at most three strokes each. */
const GLYPHS: Record<UnitIconId, ReactElement> = {
  gpu: (
    <>
      <rect x="6.75" y="6.75" width="10.5" height="10.5" rx="2" />
      <rect x="10" y="10" width="4" height="4" rx="0.75" />
      <path d="M9.5 3.75v3M14.5 3.75v3M9.5 17.25v3M14.5 17.25v3M3.75 9.5h3M3.75 14.5h3M17.25 9.5h3M17.25 14.5h3" />
    </>
  ),
  power: <path d="M13.25 2.75 4.75 13.5h7l-1 7.75 8.5-10.75h-7z" />,
  fabric: (
    <>
      <rect x="9" y="3.25" width="6" height="4.5" rx="1.25" />
      <path d="M12 7.75v4.5M6 16.25v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <path d="M3.75 16.25h4.5v4.5h-4.5zM15.75 16.25h4.5v4.5h-4.5z" />
    </>
  ),
  storage: (
    <>
      <ellipse cx="12" cy="6" rx="7.25" ry="2.75" />
      <path d="M4.75 6v12c0 1.52 3.25 2.75 7.25 2.75s7.25-1.23 7.25-2.75V6" />
      <path d="M4.75 12c0 1.52 3.25 2.75 7.25 2.75s7.25-1.23 7.25-2.75" />
    </>
  ),
  rate: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  revenue: (
    <>
      <path d="M3.75 20.25h16.5" />
      <path d="M5 16 10 11l3 3 6-6.25" />
      <path d="M15 7.75h4v4" />
    </>
  ),
};

/** A plain line icon for the unit slide's mini-cards, stroked in the text colour. */
export function UnitIcon({ id, className }: { id: UnitIconId; className?: string }): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[id]}
    </svg>
  );
}

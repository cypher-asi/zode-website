import type { ReactElement } from "react";

export type PortalIconName =
  | "home"
  | "rooms"
  | "orders"
  | "contracts"
  | "zrm"
  | "posts"
  | "subscribers"
  | "users"
  | "settings"
  | "person"
  | "cluster"
  | "chart";

/*
 * Drawn on a 24px grid inside a 2px margin, with at most three strokes each.
 * Every stroke has `pathLength={1}` so CSS can trace it in with a dash of 1.
 */
const GLYPHS: Record<PortalIconName, ReactElement> = {
  home: (
    <>
      <path pathLength={1} d="M4.75 10 10.7 4.88a2 2 0 0 1 2.6 0L19.25 10v8.25a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2z" />
      <path pathLength={1} d="M10 20.25V16.5a2 2 0 0 1 4 0v3.75" />
    </>
  ),
  rooms: (
    <>
      <path pathLength={1} d="M12 3 19.75 7.5v9L12 21l-7.75-4.5v-9z" />
      <path pathLength={1} d="M4.25 7.5 12 12l7.75-4.5M12 12v9" />
    </>
  ),
  orders: (
    <>
      <rect pathLength={1} x="5.5" y="5.5" width="13" height="13" rx="3" />
      <rect pathLength={1} x="9.5" y="9.5" width="5" height="5" rx="1.5" />
      <path
        pathLength={1}
        d="M10 2.75V5.5M14 2.75V5.5M10 18.5v2.75M14 18.5v2.75M2.75 10H5.5M2.75 14H5.5M18.5 10h2.75M18.5 14h2.75"
      />
    </>
  ),
  contracts: (
    <>
      <path pathLength={1} d="M18.75 7.5v11.75a2 2 0 0 1-2 2H7.25a2 2 0 0 1-2-2V4.75a2 2 0 0 1 2-2H14z" />
      <path pathLength={1} d="M14 2.75V6a1.5 1.5 0 0 0 1.5 1.5h3.25" />
      <path pathLength={1} d="M8.25 17.5c.9-2 2-2.3 2.6-.9s1.4 1.4 2.3-.2c.6-.9 1.7-.6 2.6.3" />
    </>
  ),
  zrm: (
    <>
      <rect pathLength={1} x="3.25" y="4.75" width="17.5" height="14.5" rx="2.5" />
      <circle pathLength={1} cx="9" cy="10.5" r="2.25" />
      <path pathLength={1} d="M5.75 16.25a3.5 3.25 0 0 1 6.5 0M14.5 9.75h3.25M14.5 13.25h3.25" />
    </>
  ),
  posts: (
    <>
      <path pathLength={1} d="M15.5 4.5a2.12 2.12 0 0 1 3 3l-10 10-4 1 1-4z" />
      <path pathLength={1} d="m13.5 6.5 3 3" />
      <path pathLength={1} d="M12.5 20.25h7" />
    </>
  ),
  subscribers: (
    <>
      <rect pathLength={1} x="3" y="5.5" width="18" height="13" rx="3" />
      <path pathLength={1} d="M6.75 9.25 10.8 12.1a2 2 0 0 0 2.4 0l4.05-2.85" />
    </>
  ),
  users: (
    <>
      <circle pathLength={1} cx="9" cy="8.5" r="3.25" />
      <path pathLength={1} d="M3.25 19.5a5.75 5.5 0 0 1 11.5 0" />
      <path pathLength={1} d="M15.25 5.35a3.25 3.25 0 0 1 0 6.3M17.25 14.4a5.75 5.5 0 0 1 3.5 5.1" />
    </>
  ),
  settings: (
    <>
      <path
        pathLength={1}
        d="M9.91 5.58 10.59 3.11A9 9 0 0 1 13.41 3.11L14.09 5.58A6.75 6.75 0 0 1 16.52 6.98L18.99 6.34A9 9 0 0 1 20.4 8.78L18.6 10.6A6.75 6.75 0 0 1 18.6 13.4L20.4 15.22A9 9 0 0 1 18.99 17.66L16.52 17.02A6.75 6.75 0 0 1 14.09 18.42L13.41 20.89A9 9 0 0 1 10.59 20.89L9.91 18.42A6.75 6.75 0 0 1 7.48 17.02L5.01 17.66A9 9 0 0 1 3.6 15.22L5.4 13.4A6.75 6.75 0 0 1 5.4 10.6L3.6 8.78A9 9 0 0 1 5.01 6.34L7.48 6.98A6.75 6.75 0 0 1 9.91 5.58z"
      />
      <circle pathLength={1} cx="12" cy="12" r="2.75" />
    </>
  ),
  person: (
    <>
      <circle pathLength={1} cx="12" cy="8.5" r="3.75" />
      <path pathLength={1} d="M5.5 20a6.5 6 0 0 1 13 0" />
    </>
  ),
  cluster: (
    <>
      <rect pathLength={1} x="3.75" y="3.75" width="7" height="7" rx="2" />
      <rect pathLength={1} x="13.25" y="3.75" width="7" height="7" rx="2" />
      <path pathLength={1} d="M5.75 13.25h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zm9.5 0h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" />
    </>
  ),
  chart: (
    <>
      <path pathLength={1} d="M4.75 19.25h14.5" />
      <path pathLength={1} d="M7.75 15.75v-4M12 15.75v-8.5M16.25 15.75v-6" />
    </>
  ),
};

/** The portal's line icons: one 24px grid, one rounded 1.5 stroke, drawn in `currentColor`. */
export function PortalIcon({ name, className }: { name: PortalIconName; className?: string }): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  );
}

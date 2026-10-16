import type { CSSProperties, ReactElement, ReactNode } from "react";
import { initials, type ZrmType } from "./types";
import styles from "./zrm.module.css";

type IconName = "search" | "plus" | "star" | "trash" | "back" | "close" | "sort" | "check" | "next" | "external";

const GLYPHS: Record<IconName, ReactElement> = {
  search: (
    <>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </>
  ),
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  star: <path d="m8 2.5 1.7 3.45 3.8.55-2.75 2.68.65 3.78L8 11.18l-3.4 1.78.65-3.78L2.5 6.5l3.8-.55z" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />,
  back: <path d="M10 3.5 5.5 8l4.5 4.5" />,
  close: <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />,
  sort: <path d="m4.5 6.5 3.5-3 3.5 3M4.5 9.5l3.5 3 3.5-3" />,
  check: <path d="m3.5 8.5 3 3 6-7" />,
  next: <path d="M6 3.5 10.5 8 6 12.5" />,
  external: <path d="M9 3.5h3.5V7M12.5 3.5 7 9M11 9.5v3H3.5V5h3" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      {GLYPHS[name]}
    </svg>
  );
}

/** A stable hue per name, so a record keeps its colour everywhere it appears. */
function hue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

/**
 * Initials rather than photos: the site's CSP and COEP only allow same-origin
 * images, and photo and logo URLs point at LinkedIn and company sites.
 */
export function Avatar({
  name,
  shape = "round",
  size = "md",
}: {
  name: string;
  shape?: "round" | "square";
  size?: "md" | "lg";
}): ReactElement {
  return (
    <span
      className={styles.avatar}
      data-shape={shape}
      data-size={size}
      style={{ "--hue": hue(name) } as CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function TypeBadges({ ids, types }: { ids: readonly string[]; types: ReadonlyMap<string, ZrmType> }): ReactElement | null {
  const shown = ids.map((id) => types.get(id)).filter((type): type is ZrmType => Boolean(type));
  if (shown.length === 0) return null;
  return (
    <span className={styles.badges}>
      {shown.map((type) => (
        <Badge key={type.id} color={type.color}>
          {type.name}
        </Badge>
      ))}
    </span>
  );
}

export function Badge({ children, color }: { children: ReactNode; color?: string }): ReactElement {
  return (
    <span
      className={styles.badge}
      data-color={color ? "" : undefined}
      style={color ? ({ "--badge-color": color } as CSSProperties) : undefined}
    >
      {children}
    </span>
  );
}

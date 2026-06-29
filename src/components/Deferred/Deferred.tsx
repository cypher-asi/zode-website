"use client";

import { useRef, type ReactElement, type ReactNode } from "react";
import { useInView } from "@/lib/useInView";

interface DeferredProps {
  /** Heavy subtree to mount once the wrapper nears the viewport. */
  readonly children: ReactNode;
  /** Optional class for the always-present wrapper (keeps layout stable). */
  readonly className?: string;
  /** Placeholder rendered before the children mount. Defaults to nothing. */
  readonly fallback?: ReactNode;
  /** IntersectionObserver root margin; how early to mount before entering. */
  readonly rootMargin?: string;
}

/**
 * Renders a stable wrapper element immediately but only mounts its children
 * once it scrolls near the viewport. Used to keep expensive widgets (e.g.
 * recharts charts) from rendering on the initial load of the full-deck pages,
 * where every slide is mounted at once.
 */
export function Deferred({
  children,
  className,
  fallback = null,
  rootMargin,
}: DeferredProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, rootMargin);

  return (
    <div ref={ref} className={className}>
      {inView ? children : fallback}
    </div>
  );
}

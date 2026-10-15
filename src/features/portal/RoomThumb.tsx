"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

/**
 * A room's site map, cropped to its tile in the room list, or `fallback` when
 * the room has no address or the map won't load.
 */
export function RoomThumb({ src, fallback }: { src: string | null; fallback: ReactNode }): ReactElement {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  // An image that errored before hydration fires no event React can see.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!src || failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- already sized by Google and served from our own route
  return <img ref={ref} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

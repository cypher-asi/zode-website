"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./Summary.module.css";

/**
 * The site's map preview, linked to Google Maps. It disappears when the image
 * won't load (Google refused, or the key lacks the Static Maps API), leaving
 * the address link beside it.
 */
export function SiteMap({
  src,
  href,
  alt,
  width,
  height,
}: {
  src: string;
  href: string;
  alt: string;
  width: number;
  height: number;
}): ReactElement | null {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  // An image that errored before hydration fires no event React can see.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.siteMap}>
      {/* eslint-disable-next-line @next/next/no-img-element -- already sized by Google and served from our own route */}
      <img ref={ref} src={src} alt={alt} width={width} height={height} onError={() => setFailed(true)} />
    </a>
  );
}

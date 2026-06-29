"use client";

import dynamic from "next/dynamic";
import { useRef, type ComponentProps, type ReactElement } from "react";
import { useInView } from "@/lib/useInView";
import type { CabinScene } from "./CabinScene";
import styles from "./CabinScene.module.css";

// Code-split three.js and the cabin scene into their own chunk so the initial
// /invest payload never includes them. `ssr: false` keeps the WebGL-only code
// off the server render (it does nothing useful there anyway).
const CabinSceneImpl = dynamic(
  () => import("./CabinScene").then((mod) => mod.CabinScene),
  { ssr: false },
);

type CabinSceneProps = ComponentProps<typeof CabinScene>;

/**
 * Defers everything expensive about {@link CabinScene} — downloading three.js,
 * fetching + parsing the ~7.7 MB model, and creating a WebGL context — until
 * the scene is about to scroll into view. The invest deck mounts every slide
 * at once, so without this gate both cabin scenes would do all of that work
 * during the initial page load.
 */
export function LazyCabinScene(props: CabinSceneProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  // No bottom margin: the cabin slide sits directly below the cover, so any
  // positive margin would trip the observer (and load the model) on first
  // paint, defeating the deferral.
  const inView = useInView(hostRef, "0px");

  const className = [
    styles.wrapper,
    props.matchPageBackground ? styles.matchPageBg : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={hostRef} className={className}>
      {inView ? <CabinSceneImpl {...props} /> : null}
    </div>
  );
}

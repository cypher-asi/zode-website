"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./PinnedHeader.module.css";

type Tone = "light" | "dark";

/** Content is fully transparent this far below the wordmark and button... */
const FADE_GAP = 8;
/** ...and fully opaque again this much further down. */
const FADE_LENGTH = 64;
/** The faded corners reach this far toward the middle past the wordmark and button... */
const SIDE_PAD = 24;
/** ...and blend back to opaque over this much more. */
const SIDE_FEATHER = 64;

/** Surface tone (`data-surface`) of whatever sits under the center of `el`. */
function sampleTone(el: HTMLElement): Tone | null {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (const node of document.elementsFromPoint(x, y)) {
    if (el.contains(node)) continue;
    const surface = node.closest<HTMLElement>("[data-surface]")?.dataset.surface;
    if (surface === "light" || surface === "dark") return surface;
  }
  return null;
}

/**
 * Top-left wordmark and top-right "Rent Compute" button that stay fixed while
 * the page scrolls. Each is black over light surfaces and white over dark ones:
 * it reads the nearest `data-surface` ancestor of whatever sits under its
 * center point. Content marked with `data-top-fade` is masked out as it scrolls
 * up into the top corners, while the top middle stays solid. `data-top-fade`
 * set to "left" or "right" limits the fade to that corner (the hero gallery
 * starts under the button, so it only fades under the wordmark). Section
 * backgrounds stay unmarked so the surface behind both remains solid.
 */
export function PinnedHeader({
  showAction = true,
}: {
  /** Set false to leave out the top-right action, e.g. on the page it links to. */
  showAction?: boolean;
}): ReactElement {
  const brandRef = useRef<HTMLAnchorElement>(null);
  const actionRef = useRef<HTMLAnchorElement>(null);
  const [brandTone, setBrandTone] = useState<Tone>("light");
  const [actionTone, setActionTone] = useState<Tone>("light");

  useEffect(() => {
    let frame = 0;

    const sample = () => {
      frame = 0;
      const brand = brandRef.current;
      const action = actionRef.current;
      if (!brand) return;
      const brandRect = brand.getBoundingClientRect();
      const actionRect = action?.getBoundingClientRect();

      const clear = Math.max(brandRect.bottom, actionRect?.bottom ?? 0) + FADE_GAP;
      const solid = clear + FADE_LENGTH;
      const leftEdge = brandRect.right + SIDE_PAD;
      const rightEdge = actionRect ? actionRect.left - SIDE_PAD : Infinity;
      for (const node of document.querySelectorAll<HTMLElement>("[data-top-fade]")) {
        const { top, left, right } = node.getBoundingClientRect();
        const sides = node.dataset.topFade;
        const fadeLeft = sides !== "right" && left < leftEdge;
        const fadeRight = sides !== "left" && right > rightEdge;
        if (solid - top <= 0 || (!fadeLeft && !fadeRight)) {
          node.style.maskImage = "";
          continue;
        }

        const vertical = `linear-gradient(to bottom, transparent ${clear - top}px, #000 ${solid - top}px)`;
        // On narrow screens the two corners meet, so the whole top band fades.
        if (fadeLeft && fadeRight && rightEdge - leftEdge < 2 * SIDE_FEATHER) {
          node.style.maskImage = vertical;
          continue;
        }
        const stops = [
          ...(fadeLeft
            ? [`transparent ${leftEdge - left}px`, `#000 ${leftEdge - left + SIDE_FEATHER}px`]
            : ["#000 0px"]),
          ...(fadeRight
            ? [`#000 ${rightEdge - left - SIDE_FEATHER}px`, `transparent ${rightEdge - left}px`]
            : ["#000 100%"]),
        ];
        // Mask layers composite with `add`, so content hides only in the top band at the sides.
        node.style.maskImage = `${vertical}, linear-gradient(to right, ${stops.join(", ")})`;
      }

      const nextBrandTone = sampleTone(brand);
      if (nextBrandTone) setBrandTone(nextBrandTone);
      if (action) {
        const nextActionTone = sampleTone(action);
        if (nextActionTone) setActionTone(nextActionTone);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [showAction]);

  return (
    <>
      <Link
        ref={brandRef}
        className={styles.brand}
        href="/"
        aria-label="ZODE — home"
        data-tone={brandTone}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.wordmark} src="/wordmark.png" alt="" aria-hidden="true" />
      </Link>
      {showAction ? (
        <Link ref={actionRef} className={styles.action} href="/rent-compute" data-tone={actionTone}>
          Rent Compute
        </Link>
      ) : null}
    </>
  );
}

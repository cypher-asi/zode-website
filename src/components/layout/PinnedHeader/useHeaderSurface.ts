"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type Tone = "light" | "dark";

/** Content is fully transparent this far below the wordmark and button... */
const FADE_GAP = 8;
/** ...and fully opaque again this much further down. */
const FADE_LENGTH = 64;
/** The faded corners reach this far toward the middle past the wordmark and button... */
const SIDE_PAD = 24;
/** ...and blend back to opaque over this much more. */
const SIDE_FEATHER = 64;
/** A cover's mask while nothing sits under the corners. */
const COVER_HIDDEN = "linear-gradient(transparent, transparent)";

/** The fade band under the wordmark and button, in viewport pixels. */
type FadeBand = { clear: number; solid: number; leftEdge: number; rightEdge: number };

/**
 * The mask fading content at `rect` out of the top corners, or for a cover the
 * inverse, showing it only there. `null` when the node sits clear of them.
 */
function topFadeMask(
  { top, left, right }: DOMRect,
  sides: string | undefined,
  cover: boolean,
  { clear, solid, leftEdge, rightEdge }: FadeBand,
): string | null {
  const fadeLeft = sides !== "right" && left < leftEdge;
  const fadeRight = sides !== "left" && right > rightEdge;
  if (solid - top <= 0 || (!fadeLeft && !fadeRight)) return null;

  const [hidden, shown] = cover ? ["#000", "transparent"] : ["transparent", "#000"];
  const vertical = `linear-gradient(to bottom, ${hidden} ${clear - top}px, ${shown} ${solid - top}px)`;
  // On narrow screens the two corners meet, so the whole top band fades.
  if (fadeLeft && fadeRight && rightEdge - leftEdge < 2 * SIDE_FEATHER) return vertical;
  const stops = [
    ...(fadeLeft
      ? [`${hidden} ${leftEdge - left}px`, `${shown} ${leftEdge - left + SIDE_FEATHER}px`]
      : [`${shown} 0px`]),
    ...(fadeRight
      ? [`${shown} ${rightEdge - left - SIDE_FEATHER}px`, `${hidden} ${rightEdge - left}px`]
      : [`${shown} 100%`]),
  ];
  // Content's layers composite with `add`, hiding it only in the top band at the sides; a cover's must `intersect`.
  return `${vertical}, linear-gradient(to right, ${stops.join(", ")})`;
}

/**
 * What sits under the center of `el`: the surface tone (`data-surface`) and
 * whether it's photography (`data-media`), whose tone varies shot to shot.
 * `null` while nothing but the bare root is there, e.g. before a page paints.
 */
function sampleUnder(el: HTMLElement, rect: DOMRect): { tone: Tone | null; media: boolean } | null {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const nodes = document.elementsFromPoint(x, y);
  if (nodes.every((node) => node === document.documentElement)) return null;
  let tone: Tone | null = null;
  let media = false;
  for (const node of nodes) {
    if (el.contains(node)) continue;
    if (!media && node.closest("[data-media]")) media = true;
    if (!tone) {
      const surface = node.closest<HTMLElement>("[data-surface]")?.dataset.surface;
      if (surface === "light" || surface === "dark") tone = surface;
    }
    if (tone && media) break;
  }
  return { tone, media };
}

/**
 * Reads the surface under the wordmark and the right-hand group, and fades
 * content out of the top corners around them (see PinnedHeader). Runs while
 * `enabled`; `resample` re-reads after the page under them changes.
 */
export function useHeaderSurface(
  brandRef: RefObject<HTMLElement | null>,
  groupRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): { brandTone: Tone; actionTone: Tone; actionOverMedia: boolean; resample: () => void } {
  const [brandTone, setBrandTone] = useState<Tone>("light");
  const [actionTone, setActionTone] = useState<Tone>("light");
  const [actionOverMedia, setActionOverMedia] = useState(false);
  const scheduleRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    // Faded nodes near the top of the viewport. Only these are measured each
    // frame; the margins are generous so a node is tracked well before it
    // reaches the fade band, even on a fast fling.
    const observed = new WeakSet<HTMLElement>();
    const near = new Set<HTMLElement>();
    // Last mask written per node, so unchanged masks aren't rewritten (each write repaints the node).
    const masks = new WeakMap<HTMLElement, string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          if (entry.isIntersecting) near.add(node);
          else near.delete(node);
        }
        schedule();
      },
      { rootMargin: "50% 0px -25% 0px" },
    );

    const setMask = (node: HTMLElement, mask: string) => {
      if (masks.get(node) === mask) return;
      masks.set(node, mask);
      node.style.maskImage = mask;
    };

    // Sections such as the assembly line mount late and routes swap the page,
    // so the faded nodes are re-queried whenever one is added or removed.
    // Mutation records arrive as microtasks, so `stale` is always set before
    // the next frame samples.
    const TRACKED = "[data-top-fade], [data-top-fade-cover]";
    let fades: HTMLElement[] = [];
    let coverNodes: HTMLElement[] = [];
    let stale = true;
    const tracked = (node: Node) =>
      node instanceof Element && (node.matches(TRACKED) || node.querySelector(TRACKED) !== null);
    const structure = new MutationObserver((records) => {
      if (stale) return;
      stale = records.some(
        (record) =>
          record.type === "attributes" ||
          [...record.addedNodes].some(tracked) ||
          [...record.removedNodes].some(tracked),
      );
    });
    structure.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-top-fade", "data-top-fade-cover"],
    });

    const sample = () => {
      frame = 0;
      const brand = brandRef.current;
      const action = groupRef.current;
      if (!brand || !action) return;

      if (stale) {
        stale = false;
        fades = Array.from(document.querySelectorAll<HTMLElement>("[data-top-fade]"));
        coverNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-top-fade-cover]"));
      }

      // Reads first: interleaving them with the mask writes below would force a style recalc per node.
      const brandRect = brand.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      const measured: [HTMLElement, DOMRect][] = [];
      for (const node of fades) {
        if (!observed.has(node)) {
          // Treated as near until the observer's first report says otherwise.
          observed.add(node);
          near.add(node);
          io.observe(node);
        }
        if (near.has(node)) {
          measured.push([node, node.getBoundingClientRect()]);
        } else {
          setMask(node, "");
        }
      }
      // Covers are pinned to the top, so they're always measured; their masks only change on resize.
      const covers = coverNodes.map((node) => [node, node.getBoundingClientRect()] as const);
      const brandUnder = sampleUnder(brand, brandRect);
      const actionUnder = sampleUnder(action, actionRect);

      const clear = Math.max(brandRect.bottom, actionRect.bottom) + FADE_GAP;
      const band: FadeBand = {
        clear,
        solid: clear + FADE_LENGTH,
        leftEdge: brandRect.right + SIDE_PAD,
        rightEdge: actionRect.width > 0 ? actionRect.left - SIDE_PAD : Infinity,
      };
      for (const [node, rect] of measured) {
        setMask(node, topFadeMask(rect, node.dataset.topFade, false, band) ?? "");
      }
      for (const [node, rect] of covers) {
        setMask(node, topFadeMask(rect, undefined, true, band) ?? COVER_HIDDEN);
      }

      // Nothing else re-samples once the page paints (the deck doesn't scroll), so keep looking until it has.
      if (brandUnder === null || actionUnder === null) schedule();
      if (brandUnder?.tone) setBrandTone(brandUnder.tone);
      if (actionUnder) {
        if (actionUnder.tone) setActionTone(actionUnder.tone);
        setActionOverMedia(actionUnder.media);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };
    scheduleRef.current = schedule;

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Surfaces can also change tone in place, e.g. the deck's ground between
    // slides, or be swapped for another, e.g. the deck replacing its stand-in ground.
    const surfaced = (node: Node) =>
      node instanceof Element && (node.matches("[data-surface]") || node.querySelector("[data-surface]") !== null);
    const surfaces = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.type === "attributes" ||
            [...record.addedNodes].some(surfaced) ||
            [...record.removedNodes].some(surfaced),
        )
      ) {
        schedule();
      }
    });
    surfaces.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-surface"],
    });
    return () => {
      scheduleRef.current = () => {};
      cancelAnimationFrame(frame);
      io.disconnect();
      structure.disconnect();
      surfaces.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled, brandRef, groupRef]);

  const resample = useCallback(() => scheduleRef.current(), []);

  return {
    brandTone: enabled ? brandTone : "light",
    actionTone: enabled ? actionTone : "light",
    actionOverMedia: enabled && actionOverMedia,
    resample,
  };
}

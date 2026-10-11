"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import Image from "next/image";
import styles from "./ZodeGallery.module.css";

interface Shot {
  readonly src: string;
  readonly label: string;
  readonly alt: string;
}

const SHOTS: readonly Shot[] = [
  {
    src: "/images/future-home/zode-hero.jpg",
    label: "Dusk",
    alt: "Glass-walled ZODE at dusk, its compute racks and warm wall lights glowing through the glazing",
  },
  {
    src: "/images/future-home/zode-cutaway.jpg",
    label: "Cutaway",
    alt: "Cutaway of a ZODE showing its timber-lined steel frame, compute racks, and office",
  },
  {
    src: "/images/future-home/zode-exterior.jpg",
    label: "Exterior",
    alt: "Side view of a glass-walled ZODE with its gabled roof and entrance deck",
  },
  {
    src: "/images/future-home/zode-hall.jpg",
    label: "Compute Hall",
    alt: "Close view through the ZODE glazing onto the row of compute racks",
  },
  {
    src: "/images/future-home/zode-overview.jpg",
    label: "Overview",
    alt: "Isometric overview of a ZODE from above",
  },
  {
    src: "/images/future-home/zode-entrance.jpg",
    label: "Entrance",
    alt: "Gabled glass entrance of a ZODE with its front deck",
  },
  {
    src: "/images/future-home/zode-interior.jpg",
    label: "Interior",
    alt: "Front view into the ZODE interior, split between the compute hall and a warm office zone",
  },
];

/** How far a touch must travel sideways, in px, to count as a swipe rather than a tap. */
const SWIPE_MIN = 40;

const wrap = (index: number) => (index + SHOTS.length) % SHOTS.length;

/** Runs `callback` once the browser is idle (Safari lacks requestIdleCallback). */
function whenIdle(callback: () => void): void {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(callback, { timeout: 3000 });
  else window.setTimeout(callback, 1000);
}

/**
 * One ZODE render at a time, advanced only by the user, with dot indicators
 * along the bottom. Images are stacked so switching cross-fades without a
 * layout jump or a fresh network fetch. Only the first render loads up front
 * so it isn't competing for bandwidth; once it has loaded its neighbours mount,
 * then the rest when the browser goes idle. The first render stays hidden
 * until it has decoded, then eases in, rather than cutting in or
 * painting in as it downloads. On touch, swiping left or right steps through the shots.
 */
export function ZodeGallery(): ReactElement {
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [entered, setEntered] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const baseId = useId();

  const mount = (indices: readonly number[]) =>
    setMounted((prev) => (indices.every((i) => prev.has(i)) ? prev : new Set([...prev, ...indices])));

  /** next/image calls this once the first render has decoded, even if it loaded before hydration. */
  const onFirstLoad = () => {
    setEntered(true);
    mount([wrap(-1), 1]);
    whenIdle(() => mount(SHOTS.map((_, i) => i)));
  };

  const select = (index: number, focus = false) => {
    const next = wrap(index);
    mount([wrap(next - 1), next, wrap(next + 1)]);
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowRight":
        select(active + 1, true);
        break;
      case "ArrowLeft":
        select(active - 1, true);
        break;
      case "Home":
        select(0, true);
        break;
      case "End":
        select(SHOTS.length - 1, true);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className={styles.gallery} data-top-fade="left" data-media>
      <div
        id={`${baseId}-panel`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
      >
        <button
          type="button"
          className={styles.stage}
          data-entered={entered || undefined}
          aria-label={`${SHOTS[active].alt}. Show next view.`}
          onPointerDown={(event) => {
            swiped.current = false;
            swipeStart.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (!start) return;
            const dx = event.clientX - start.x;
            if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
            swiped.current = true;
            select(active + (dx < 0 ? 1 : -1));
          }}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
          onClick={() => {
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            select(active + 1);
          }}
        >
          {SHOTS.map((shot, index) =>
            mounted.has(index) ? (
              <Image
                key={shot.src}
                className={styles.image}
                data-active={index === active ? "" : undefined}
                src={shot.src}
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : undefined}
                onLoad={index === 0 ? onFirstLoad : undefined}
              />
            ) : null,
          )}
        </button>
      </div>

      <div className={styles.bar} role="tablist" aria-label="ZODE views">
        {SHOTS.map((shot, index) => {
          const selected = index === active;
          return (
            <button
              key={shot.src}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              id={`${baseId}-tab-${index}`}
              className={styles.dot}
              role="tab"
              aria-label={shot.label}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={onTabKeyDown}
            />
          );
        })}
      </div>
    </div>
  );
}

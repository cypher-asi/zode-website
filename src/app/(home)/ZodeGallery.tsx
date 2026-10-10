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

/**
 * One ZODE render at a time, advanced only by the user, with dot indicators
 * along the bottom. Every image stays mounted and stacked so switching
 * cross-fades without a layout jump or a fresh network fetch.
 */
export function ZodeGallery(): ReactElement {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const select = (index: number, focus = false) => {
    const next = (index + SHOTS.length) % SHOTS.length;
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
          aria-label={`${SHOTS[active].alt}. Show next view.`}
          onClick={() => select(active + 1)}
        >
          {SHOTS.map((shot, index) => (
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
            />
          ))}
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

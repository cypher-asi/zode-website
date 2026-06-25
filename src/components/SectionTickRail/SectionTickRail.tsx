"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react";
import styles from "./SectionTickRail.module.css";

const CLOSE_DEBOUNCE_MS = 80;

export interface RailSection {
  readonly id: string;
  readonly label: string;
}

export interface SectionTickRailProps {
  readonly sections: readonly RailSection[];
  /** Id of the scrollable container the sections live in. */
  readonly scrollRootId: string;
  /** Anchor id of the cover slide; the rail's logo button returns here. */
  readonly coverId: string;
}

/**
 * Right-edge navigation rail ported from aura-os's PersonaTickRail. In
 * its resting state it shows one horizontal tick per section. Hovering
 * (or keyboard-focusing) expands a floating panel that covers the tick
 * column and lists every section as a clickable row; selecting a row
 * smooth-scrolls to that section. The active tick is derived from an
 * IntersectionObserver over the section elements.
 *
 * Close behaviour matches the original: an 80ms debounced close so the
 * cursor can cross from the ticks onto the panel, and a direction-aware
 * skip when the pointer exits past the viewport's right edge.
 */
export function SectionTickRail({
  sections,
  scrollRootId,
  coverId,
}: SectionTickRailProps): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<string>(coverId);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = document.getElementById(scrollRootId);
    const observedIds = [coverId, ...sections.map((section) => section.id)];
    const elements = observedIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }
        let bestId = activeId;
        let bestRatio = -1;
        for (const [id, ratio] of visibility) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestRatio > 0) setActiveId(bestId);
      },
      {
        root,
        rootMargin: "-45% 0px -45% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
    // `activeId` is intentionally excluded; it is seeded inside the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, scrollRootId, coverId]);

  const cancelScheduledClose = (): void => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const open = (): void => {
    cancelScheduledClose();
    setIsOpen(true);
  };

  const scheduleClose = (): void => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, CLOSE_DEBOUNCE_MS);
  };

  const handleMouseLeave = (event: ReactMouseEvent<HTMLElement>): void => {
    if (event.clientX >= window.innerWidth - 1) return;
    scheduleClose();
  };

  const goToSection = (id: string): void => {
    cancelScheduledClose();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
    setIsOpen(false);
  };

  useEffect(() => cancelScheduledClose, []);

  return (
    <div
      className={styles.rail}
      data-panel-open={isOpen ? "true" : "false"}
      onMouseEnter={open}
      onMouseLeave={handleMouseLeave}
    >
      <ul className={styles.list} aria-label="Section navigation">
        {sections.map((section, index) => {
          const isActive = section.id === activeId;
          return (
            <li key={section.id} className={styles.row}>
              <button
                type="button"
                className={styles.tickButton}
                aria-label={`${index + 1}. ${section.label}`}
                aria-current={isActive ? "true" : undefined}
                data-active={isActive ? "true" : "false"}
                onFocus={open}
                onBlur={scheduleClose}
                onClick={() => goToSection(section.id)}
              >
                <span className={styles.tick} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <div
        className={styles.panel}
        aria-hidden={isOpen ? undefined : "true"}
        onMouseEnter={open}
        onMouseLeave={handleMouseLeave}
      >
        <ul className={styles.panelList}>
          {sections.map((section, index) => (
            <li key={section.id} className={styles.panelRow}>
              <button
                type="button"
                className={styles.panelItem}
                data-active={section.id === activeId ? "true" : "false"}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => goToSection(section.id)}
              >
                <span className={styles.panelIndex}>{index + 1}.</span>
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

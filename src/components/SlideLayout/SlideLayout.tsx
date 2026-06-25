import type { ReactElement, ReactNode } from "react";
import styles from "./SlideLayout.module.css";

interface SlideLayoutProps {
  /** Anchor id used by the tick-rail navigation. */
  readonly id: string;
  /** Accessible label for the slide section. */
  readonly ariaLabel: string;
  /**
   * Top band content. Vertically centered within the space the band is given.
   * Optional — when omitted the band stays empty but still balances the bottom
   * band so the middle stays page-centered.
   */
  readonly top?: ReactNode;
  /**
   * Middle band content. Always vertically centered on the page, irrespective
   * of how much content sits in the top and bottom bands.
   */
  readonly middle: ReactNode;
  /** Bottom band content. Vertically centered within its available space. */
  readonly bottom?: ReactNode;
  /** Optional override for the section (e.g. variant-specific padding/grid). */
  readonly className?: string;
  /** Optional overrides for the individual bands. */
  readonly topClassName?: string;
  readonly middleClassName?: string;
  readonly bottomClassName?: string;
}

/**
 * Shared full-panel slide primitive. A three-row grid keeps the middle band
 * dead-center on the panel (the top and bottom rows are equal flexible space),
 * while each of the top and bottom bands centers its own content within the
 * room it is given. Every deck slide is built on this so the vertical rhythm
 * is identical across pages.
 */
export function SlideLayout({
  id,
  ariaLabel,
  top,
  middle,
  bottom,
  className,
  topClassName,
  middleClassName,
  bottomClassName,
}: SlideLayoutProps): ReactElement {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={[styles.slide, className].filter(Boolean).join(" ")}
    >
      <div className={[styles.top, topClassName].filter(Boolean).join(" ")}>
        {top}
      </div>
      <div
        className={[styles.middle, middleClassName].filter(Boolean).join(" ")}
      >
        {middle}
      </div>
      <div
        className={[styles.bottom, bottomClassName].filter(Boolean).join(" ")}
      >
        {bottom}
      </div>
    </section>
  );
}

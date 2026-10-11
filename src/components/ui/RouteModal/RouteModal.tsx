"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./RouteModal.module.css";

/** Closes the surrounding modal; `null` when the content is shown as a standalone page. */
const CloseContext = createContext<(() => void) | null>(null);

export const useModalClose = (): (() => void) | null => useContext(CloseContext);

/** Exit animation length; keep in step with `--exit` in RouteModal.module.css. */
const EXIT_MS = 220;
/** A downward drag on the sheet's handle further than this dismisses it. */
const DISMISS_DRAG = 96;

/**
 * Native modal `<dialog>` for an intercepted route: it traps focus and makes
 * the page behind it inert. Every way out (Escape, a backdrop click, the
 * close button, a drag down on the mobile sheet) plays the exit animation,
 * then steps back in history so the URL returns to the page underneath.
 * The panel is 560px wide unless `className` sets `--modal-width`.
 */
export function RouteModal({
  children,
  className,
  label,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  /** Id of the content's heading, for modals whose title changes with the route. */
  labelledBy?: string;
}): ReactElement {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const pressedBackdrop = useRef(false);
  const drag = useRef<{ id: number; startY: number; dy: number } | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Focus the panel rather than its first field, so phones don't open the keyboard straight away.
    panelRef.current?.focus({ preventScroll: true });

    const root = document.documentElement;
    const { overflow } = root.style;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
    };
  }, []);

  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setClosing(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => {
        dialogRef.current?.close();
        router.back();
      },
      reduced ? 0 : EXIT_MS,
    );
  }, [router]);

  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };

  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    // Only a press that started and ended on the backdrop, not a text selection dragged out of the card.
    if (pressedBackdrop.current && event.target === event.currentTarget) close();
    pressedBackdrop.current = false;
  };

  const onHandleDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, startY: event.clientY, dy: 0 };
    panelRef.current?.setAttribute("data-dragging", "");
  };

  const onHandleMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const panel = panelRef.current;
    if (!state || state.id !== event.pointerId || !panel) return;
    state.dy = Math.max(0, event.clientY - state.startY);
    panel.style.transform = `translateY(${state.dy}px)`;
  };

  const onHandleUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const panel = panelRef.current;
    if (!state || state.id !== event.pointerId || !panel) return;
    drag.current = null;
    panel.removeAttribute("data-dragging");
    if (state.dy > DISMISS_DRAG) {
      close();
    } else {
      panel.style.transform = "";
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={className ? `${styles.dialog} ${className}` : styles.dialog}
      aria-label={label}
      aria-labelledby={labelledBy}
      data-closing={closing || undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      // Some browsers close on a repeated Escape without a cancellable event; still leave the route.
      onClose={() => {
        if (leaving.current) return;
        leaving.current = true;
        router.back();
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div ref={panelRef} className={styles.panel} tabIndex={-1}>
        <div
          className={styles.handle}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-hidden="true"
        >
          <span />
        </div>
        <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
      </div>
    </dialog>
  );
}

"use client";

import { useEffect, type RefObject } from "react";

function isAvailable(input: HTMLInputElement): boolean {
  return (
    input.type !== "hidden" &&
    !input.disabled &&
    !input.readOnly &&
    !input.value &&
    input.getClientRects().length > 0
  );
}

/**
 * Focuses the form's first enabled, visible, empty input on mount and
 * whenever the action `state` or the form's `view` changes. Waits a frame so
 * it lands after RouteModal opens and focuses its panel. Skipped on touch
 * screens, where it would throw up the keyboard before they've seen the form.
 */
export function useFocusFirstField(formRef: RefObject<HTMLFormElement | null>, state: unknown, view = ""): void {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const frame = requestAnimationFrame(() => {
      const inputs = Array.from(formRef.current?.querySelectorAll("input") ?? []);
      inputs.find(isAvailable)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [formRef, state, view]);
}

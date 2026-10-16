"use client";

import { useEffect, useState, type ReactElement } from "react";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import styles from "./portal.module.css";

/**
 * The portal panel's scrollbar, floated over whichever section's `.page` is
 * in the panel so a section that overflows keeps the same width as one that
 * doesn't. Each route renders its own `.page`, so the bar follows the panel's
 * children as they're swapped. Apps with their own frame get no bar here.
 */
export function PanelScrollbar({ panelId }: { readonly panelId: string }): ReactElement | null {
  const [page, setPage] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const resolve = (): void => {
      setPage(panel.querySelector<HTMLElement>(`:scope > .${styles.page}`));
    };
    resolve();
    const mutations = new MutationObserver(resolve);
    mutations.observe(panel, { childList: true });
    return () => mutations.disconnect();
  }, [panelId]);

  return page ? <OverlayScrollbar target={page} showOnHover /> : null;
}

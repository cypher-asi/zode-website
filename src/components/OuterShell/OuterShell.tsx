import type { ReactElement, ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { BottomTaskbar } from "@/components/BottomTaskbar";
import { SectionTickRail, type RailSection } from "@/components/SectionTickRail";
import styles from "./OuterShell.module.css";

export const SCROLL_ROOT_ID = "grid-scroll";

interface OuterShellProps {
  readonly children: ReactNode;
  readonly sections: readonly RailSection[];
}

/**
 * White outer shell with a rounded, bordered inner panel that holds the
 * scrolling content — modeled on the aura-os public-mode shell. The top
 * bar and bottom taskbar frame the inner panel; the right-edge tick rail
 * floats over the panel.
 */
export function OuterShell({ children, sections }: OuterShellProps): ReactElement {
  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.body}>
        <div id={SCROLL_ROOT_ID} className={styles.scroll}>
          {children}
        </div>
        <SectionTickRail sections={sections} scrollRootId={SCROLL_ROOT_ID} />
      </div>
      <BottomTaskbar />
    </div>
  );
}

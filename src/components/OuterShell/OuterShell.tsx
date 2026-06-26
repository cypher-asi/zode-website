import type { ReactElement, ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import { BottomTaskbar } from "@/components/BottomTaskbar";
import { SectionTickRail, type RailSection } from "@/components/SectionTickRail";
import { DeckController } from "./DeckController";
import styles from "./OuterShell.module.css";

export const SCROLL_ROOT_ID = "grid-scroll";

interface OuterShellProps {
  readonly children: ReactNode;
  readonly sections: readonly RailSection[];
  /** Anchor id of the cover slide the rail's logo button returns to. */
  readonly coverId: string;
}

/**
 * White outer shell with a rounded, bordered inner panel that holds the
 * scrolling content — modeled on the aura-os public-mode shell. The top
 * bar and bottom taskbar frame the inner panel; the right-edge tick rail
 * floats over the panel.
 */
export function OuterShell({ children, sections, coverId }: OuterShellProps): ReactElement {
  return (
    <div className={styles.shell}>
      <SiteNav />
      <div className={styles.body} data-shell-body="">

        <div id={SCROLL_ROOT_ID} className={styles.scroll}>
          {children}
        </div>
        <DeckController scrollRootId={SCROLL_ROOT_ID} slideCount={sections.length + 1} />
        <SectionTickRail
          sections={sections}
          scrollRootId={SCROLL_ROOT_ID}
          coverId={coverId}
        />
      </div>
      <BottomTaskbar />
    </div>
  );
}

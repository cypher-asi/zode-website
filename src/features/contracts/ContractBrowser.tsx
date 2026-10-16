"use client";

import { useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { Icon } from "@/features/data-room/icons";
import ui from "@/features/data-room/ui.module.css";
import portal from "@/features/portal/portal.module.css";
import styles from "./ContractBrowser.module.css";

export interface BrowserItem {
  id: string;
  title: string;
  subtitle: string;
  /** The row's content in the list: its icon, main text and end, in that order. */
  row: ReactNode;
  /** Controls at the right of the row, before its end, that work without selecting it. */
  actions?: ReactNode;
  /** The pane's content once the row is selected. */
  detail: ReactNode;
}

export interface BrowserGroup {
  key: string;
  /** Labels the group's section; unset for a single untitled list. */
  label?: string;
  /** The section's heading, e.g. its title and a link through to its type. */
  head?: ReactNode;
  items: BrowserItem[];
}

/**
 * Agreements in a list, and once one is selected, its details in a pane on
 * the right that stays in view as the list scrolls. Narrow windows show the
 * pane in the list's place, with a way back.
 */
export function ContractBrowser({ groups }: { groups: BrowserGroup[] }): ReactElement {
  const paneId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = groups.flatMap((group) => group.items).find((item) => item.id === selectedId) ?? null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !selected || (event.target as Element).closest("dialog")) return;
    setSelectedId(null);
  };

  return (
    <div className={styles.browser} data-view={selected ? "detail" : "list"} onKeyDown={onKeyDown}>
      <div className={styles.listPane}>
        {groups.map((group) => (
          <section key={group.key} className={portal.section} aria-label={group.label}>
            {group.head}
            <ul className={portal.list}>
              {group.items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <button
                    type="button"
                    className={`${portal.row} ${styles.row}`}
                    aria-current={item.id === selectedId || undefined}
                    aria-controls={item.id === selectedId ? paneId : undefined}
                    onClick={() => setSelectedId(item.id)}
                  >
                    {item.row}
                  </button>
                  {item.actions ? <div className={styles.actions}>{item.actions}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {selected ? (
        <aside id={paneId} key={selected.id} className={styles.pane} aria-label={`${selected.title} details`}>
          <header className={styles.paneHeader}>
            <button
              type="button"
              className={`${ui.iconButton} ${styles.back}`}
              onClick={() => setSelectedId(null)}
              aria-label="Back to contracts"
            >
              <Icon name="back" />
            </button>
            <div className={styles.paneTitles}>
              <h2 className={styles.paneTitle}>{selected.title}</h2>
              <p className={styles.paneSubtitle}>{selected.subtitle}</p>
            </div>
            <button
              type="button"
              className={`${ui.iconButton} ${styles.close}`}
              onClick={() => setSelectedId(null)}
              aria-label="Close details"
              title="Close"
            >
              <Icon name="close" />
            </button>
          </header>
          <div className={styles.paneBody}>{selected.detail}</div>
        </aside>
      ) : null}
    </div>
  );
}

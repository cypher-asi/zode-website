import { useEffect, useRef, type ReactElement } from "react";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import { US_NAMES } from "./charts/usTiles";
import {
  GRID_LABELS,
  LEGEND_LABELS,
  STATUS_LABELS,
  type LocalPauses,
  type PolicyKey,
  type PolicyMap,
  type PolicyMeasure,
  type PolicyState,
} from "./policyTypes";
import styles from "./Slide.module.css";

/** What the states slide lists: one state's measures, or every measure under a legend entry. */
export type PolicyChoice = { state: string; key?: never } | { key: PolicyKey; state?: never };

type Item = PolicyMeasure & { key?: PolicyKey; label?: string; group: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const nameOf = (state: string) => US_NAMES[state] ?? state;

function itemsOf(entry: PolicyState, local: readonly PolicyMeasure[]): Item[] {
  const { grid } = entry;
  return [
    ...entry.actions.map((action) => ({
      ...action,
      key: action.status,
      group: "Statewide",
    })),
    ...(grid
      ? [
          {
            ...grid,
            key: grid.gate,
            label: GRID_LABELS[grid.gate],
            group: "Grid",
          },
        ]
      : []),
    ...local.map((pause) => ({
      ...pause,
      key: "local" as const,
      group: LEGEND_LABELS.local,
    })),
  ];
}

type List = {
  title: string;
  summary: string;
  groups: { label: string; items: Item[] }[];
  /** Whether it has local pauses still to arrive, or that couldn't be read. */
  waiting: boolean;
};

/** Counts come from the map, so a list's summary is right before its local pauses arrive. */
function list(policy: PolicyMap, pauses: LocalPauses | null | undefined, { state, key }: PolicyChoice): List {
  const localOf = (code: string) => pauses?.[code] ?? [];
  if (key) {
    const codes = Object.keys(policy.states).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const groups = codes
      .map((code) => ({
        label: nameOf(code),
        items: itemsOf(policy.states[code], localOf(code)).filter((item) => item.key === key),
      }))
      .filter((group) => group.items.length);
    const local = key === "local";
    const n = local
      ? codes.reduce((sum, code) => sum + policy.states[code].localCount, 0)
      : groups.reduce((sum, group) => sum + group.items.length, 0);
    const holding = local ? codes.filter((code) => policy.states[code].localCount > 0).length : groups.length;
    return {
      title: LEGEND_LABELS[key],
      summary: `${plural(n, local ? "pause" : "measure")} in ${plural(holding, "state")}`,
      groups,
      waiting: local && !pauses && n > 0,
    };
  }
  const entry = state ? policy.states[state] : undefined;
  const items = entry && state ? itemsOf(entry, localOf(state)) : [];
  const groups = [...new Set(items.map((item) => item.group))].map((group) => ({
    label: group,
    items: items.filter((item) => item.group === group),
  }));
  const waiting = !pauses && (entry?.localCount ?? 0) > 0;
  const n = items.length + (waiting && entry ? entry.localCount : 0);
  return {
    title: state ? nameOf(state) : "",
    summary: [entry?.status ? STATUS_LABELS[entry.status] : null, plural(n, "measure")].filter(Boolean).join(" · "),
    groups,
    waiting,
  };
}

function dates({ adopted, ends }: PolicyMeasure): string | null {
  if (adopted && ends) return `${adopted} – ${ends}`;
  if (ends) return `Until ${ends}`;
  return adopted ?? null;
}

/**
 * The states slide's list for a chosen state or legend entry, over the side
 * column: each measure's title linked to its source in a new tab, where it
 * stands and when, and the tracker's note. The list scrolls under the head,
 * its bar drawn over it while hovered or scrolling (OverlayScrollbar), and the
 * deck leaves its wheel and swipes alone (`data-deck-scroll`, Deck.tsx), but
 * the deck's keys still turn the slide. It takes focus when it opens or changes,
 * and in the deck's scroll mode (`compact`), where it runs on down the page,
 * scrolls into view.
 */
export function PolicyPanel({
  id,
  policy,
  pauses,
  choice,
  compact,
  onClose,
}: {
  id: string;
  policy: PolicyMap;
  /** The local pauses: undefined while they load, null if they couldn't be read. */
  pauses: LocalPauses | null | undefined;
  choice: PolicyChoice;
  compact: boolean;
  onClose: () => void;
}): ReactElement {
  const ref = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = `${id}-list`;
  const { title, summary, groups, waiting } = list(policy, pauses, choice);

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    if (listRef.current) listRef.current.scrollTop = 0;
    panel.focus({ preventScroll: true });
    if (compact) panel.scrollIntoView({ block: "start" });
  }, [title, compact]);

  return (
    <section
      ref={ref}
      id={id}
      className={styles.policyPanel}
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      data-deck-scroll=""
    >
      <header className={styles.panelHead}>
        <div>
          <h3 id={`${id}-title`} className={styles.h3}>
            {title}
          </h3>
          <p className={styles.label}>{summary}</p>
        </div>
        <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </header>
      <div className={styles.panelFrame}>
        <div ref={listRef} id={listId} className={styles.panelList}>
          {groups.map((group) => (
            <section key={group.label} className={styles.panelGroup}>
              <h4 className={styles.label}>{group.label}</h4>
              <ul className={styles.measures}>
                {group.items.map((item) => {
                  const meta = [item.label, dates(item)].filter(Boolean).join(" · ");
                  return (
                    <li key={item.id} className={styles.measure} data-status={item.key}>
                      <span className={styles.swatch} aria-hidden="true" />
                      <div className={styles.measureText}>
                        {item.url ? (
                          <a className={styles.measureTitle} href={item.url} target="_blank" rel="noopener noreferrer">
                            {item.title}
                            <span className={styles.newTab} aria-hidden="true">
                              {" ↗"}
                            </span>
                            <span className={styles.srOnly}> (opens in a new tab)</span>
                          </a>
                        ) : (
                          <span className={styles.measureTitle}>{item.title}</span>
                        )}
                        {meta ? <span className={styles.measureMeta}>{meta}</span> : null}
                        {item.note ? <span className={styles.measureNote}>{item.note}</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {waiting ? (
            <section className={styles.panelGroup}>
              <h4 className={styles.label}>{LEGEND_LABELS.local}</h4>
              <p className={styles.measureNote} role="status">
                {pauses === null ? "The local pauses can’t be read right now." : "Loading…"}
              </p>
            </section>
          ) : null}
        </div>
        <OverlayScrollbar targetId={listId} showOnHover />
      </div>
    </section>
  );
}

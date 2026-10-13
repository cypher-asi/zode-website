import type { ReactElement } from "react";
import Link from "next/link";
import { AREAS } from "./classify";
import { DIMENSIONS, hrefWith, NONE, RANGES, today, type Dimension, type Filters } from "./filters";
import { dimensionLabel, periodLabel } from "./format";
import styles from "./analytics.module.css";

/**
 * Every report's controls, as plain links and a GET form so they work before
 * the page hydrates: the range (or custom dates), the area, whether the
 * team's own traffic counts, and a chip to clear each active filter.
 * `keep` carries the report's own params, e.g. its tab, across changes.
 */
export function Toolbar({
  path,
  filters,
  keep = {},
}: {
  path: string;
  filters: Filters;
  keep?: Record<string, string | undefined>;
}): ReactElement {
  const href = (change: Parameters<typeof hrefWith>[2]) => hrefWith(path, filters, change, keep);
  const hidden = new URLSearchParams(hrefWith(path, filters, {}, keep).split("?")[1] ?? "");
  hidden.delete("range");
  hidden.delete("from");
  hidden.delete("to");
  const chips = Object.entries(filters.dims) as [Dimension, string][];

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.period}>{periodLabel(filters.period.start, filters.period.end)}</p>
        <nav className={styles.segments} aria-label="Range">
          {RANGES.map((range) => (
            <Link
              key={range.id}
              href={href({ range: range.id })}
              className={styles.segment}
              aria-current={filters.range === range.id ? "page" : undefined}
            >
              {range.label}
            </Link>
          ))}
        </nav>
        <details className={styles.custom} open={filters.range === "custom" ? true : undefined}>
          <summary className={styles.customToggle} aria-pressed={filters.range === "custom"}>
            Custom
          </summary>
          <form className={styles.customForm} action={path} method="get">
            <input type="hidden" name="range" value="custom" />
            {[...hidden].map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <input
              className={styles.dateInput}
              type="date"
              name="from"
              aria-label="From"
              defaultValue={filters.period.start}
              max={today()}
              required
            />
            <input
              className={styles.dateInput}
              type="date"
              name="to"
              aria-label="To"
              defaultValue={filters.period.end}
              max={today()}
              required
            />
            <button className={styles.apply} type="submit">
              Apply
            </button>
          </form>
        </details>
        <nav className={styles.segments} aria-label="Area">
          <Link href={href({ area: null })} className={styles.segment} aria-current={filters.area ? undefined : "page"}>
            All
          </Link>
          {AREAS.map((area) => (
            <Link
              key={area.id}
              href={href({ area: area.id })}
              className={styles.segment}
              aria-current={filters.area === area.id ? "page" : undefined}
            >
              {area.id === "account" ? "Account" : area.label}
            </Link>
          ))}
        </nav>
        <div className={styles.segments}>
          <Link
            href={href({ team: !filters.team })}
            className={styles.segment}
            aria-pressed={filters.team}
            title="The ZODE team's own visits, signed in or on a device they've signed in on, are left out unless included."
          >
            {filters.team ? "Including team" : "Excluding team"}
          </Link>
        </div>
      </div>
      {chips.length ? (
        <div className={styles.chips}>
          {chips.map(([dim, value]) => (
            <Link key={dim} className={styles.chip} href={href({ dims: { [dim]: null } })} aria-label={`Remove ${DIMENSIONS[dim].label} filter`}>
              <span>
                {DIMENSIONS[dim].label} is <b>{value === NONE ? dimensionLabel(dim, null) : dimensionLabel(dim, value)}</b>
              </span>
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}

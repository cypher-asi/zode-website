import type { ReactElement } from "react";
import { METRIC_DEFINITIONS } from "./definitions";
import styles from "./analytics.module.css";

/** Every figure's definition, so everyone reads the reports the same way. */
export function HowWeMeasure(): ReactElement {
  return (
    <details className={styles.measure}>
      <summary>How we measure</summary>
      <dl>
        {Object.values(METRIC_DEFINITIONS).map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.description}</dd>
          </div>
        ))}
        <dt>Team traffic</dt>
        <dd>
          Visits by the ZODE team, and anything browsed on a device a team member has signed in on, are left out unless
          included from the toolbar.
        </dd>
        <dt>Sources</dt>
        <dd>
          A session keeps the channel, referrer and campaign it arrived with, so filtering by a source shows everything
          those sessions went on to do.
        </dd>
        <dt>Privacy</dt>
        <dd>
          First-party only: nothing is shared with third parties. Browsers sending Global Privacy Control or Do Not Track
          aren&apos;t recorded, nor are known bots.
        </dd>
      </dl>
    </details>
  );
}

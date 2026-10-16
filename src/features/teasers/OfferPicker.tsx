import type { ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import form from "@/features/deployments/deployments.module.css";
import { formatCount, formatDay, formatMw } from "@/features/deployments/format";
import { gpusFor, platformLabel, type Deployment } from "@/features/deployments/types";
import styles from "./teasers.module.css";

/**
 * Which of a deployment's phases a new teaser offers, e.g. to leave out one
 * already contracted. Picking redrafts the teaser from just those phases.
 */
export function OfferPicker({
  deployment,
  phases,
}: {
  deployment: Pick<Deployment, "id" | "phases">;
  /** The phases offered now, by index; null for all of them. */
  phases: readonly number[] | null;
}): ReactElement {
  return (
    <form className={form.fieldset} action="/portal/deployments/teasers/new" method="get">
      <input type="hidden" name="deployment" value={deployment.id} />
      <span className={form.legend}>Capacity to offer</span>
      <p className={form.summary}>Leave out phases that are already contracted. Redrafting replaces the teaser below.</p>
      <div className={styles.offer}>
        {deployment.phases.map((phase, i) => (
          <label key={i} className={styles.offerPhase}>
            <input type="checkbox" name="phase" value={i} defaultChecked={phases === null || phases.includes(i)} />
            <span>
              <strong>{phase.name || `Phase ${i + 1}`}</strong>
              {[
                `${formatCount(gpusFor(phase.nodes))} ${platformLabel(phase.platform)} GPUs`,
                phase.mw !== null ? formatMw(phase.mw) : null,
                `RFS ${formatDay(phase.rfsOn)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </label>
        ))}
        <button type="submit" className={ui.button}>
          Redraft
        </button>
      </div>
    </form>
  );
}

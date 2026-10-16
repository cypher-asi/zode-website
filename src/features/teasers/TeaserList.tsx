import type { ReactElement } from "react";
import Link from "next/link";
import ui from "@/features/data-room/ui.module.css";
import detail from "@/features/deployments/deployments.module.css";
import { formatDay } from "@/features/deployments/format";
import { PortalIcon } from "@/features/portal/icons";
import portal from "@/features/portal/portal.module.css";
import type { Teaser } from "./types";
import styles from "./teasers.module.css";

const Chevron = () => (
  <svg className={portal.chevron} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

/**
 * A deployment's teasers on its page, each opening its editor and PDF, with
 * the button to start another from the deployment. The ZODE team only.
 */
export function DeploymentTeasers({
  deploymentId,
  teasers,
}: {
  deploymentId: string;
  teasers: readonly Teaser[];
}): ReactElement {
  return (
    <section className={`${detail.block} ${styles.teasers}`} aria-labelledby="teasers-title">
      <div className={styles.teasersHead}>
        <h2 id="teasers-title" className={detail.blockTitle}>
          Teasers
        </h2>
        <Link href={`/portal/deployments/${deploymentId}/teasers/new`} className={ui.button}>
          Create teaser
        </Link>
      </div>
      {teasers.length ? (
        <ul className={portal.list}>
          {teasers.map((t) => (
            <li key={t.id}>
              <Link className={portal.row} href={`/portal/deployments/${deploymentId}/teasers/${t.id}`}>
                <span className={portal.rowIcon}>
                  <PortalIcon name="paper" />
                </span>
                <span className={portal.rowMain}>
                  <span className={portal.rowTitle}>{t.name}</span>
                  <span className={portal.rowMeta}>{t.headline}</span>
                </span>
                <span className={portal.rowEnd}>
                  <span className={portal.pill}>Edited {formatDay(t.updatedAt.slice(0, 10))}</span>
                  <Chevron />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={detail.muted}>
          No teasers yet. A teaser is a one-page PDF offering this deployment&apos;s capacity, filled in from its figures.
        </p>
      )}
    </section>
  );
}

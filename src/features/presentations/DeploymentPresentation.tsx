import type { ReactElement } from "react";
import Link from "next/link";
import ui from "@/features/data-room/ui.module.css";
import detail from "@/features/deployments/deployments.module.css";
import { formatDay } from "@/features/deployments/format";
import { PortalIcon } from "@/features/portal/icons";
import portal from "@/features/portal/portal.module.css";
import teasers from "@/features/teasers/teasers.module.css";
import type { Presentation } from "./types";

/** A deployment's presentation on its page, opening its editor, or the button to start one. The ZODE team only. */
export function DeploymentPresentation({
  deploymentId,
  presentation,
}: {
  deploymentId: string;
  presentation: Presentation | null;
}): ReactElement {
  const href = `/portal/deployments/${deploymentId}/presentation`;
  return (
    <section className={`${detail.block} ${teasers.teasers}`} aria-labelledby="presentation-title">
      <div className={teasers.teasersHead}>
        <h2 id="presentation-title" className={detail.blockTitle}>
          Presentation
        </h2>
        {presentation ? null : (
          <Link href={href} className={ui.button}>
            Create presentation
          </Link>
        )}
      </div>
      {presentation ? (
        <ul className={portal.list}>
          <li>
            <Link className={portal.row} href={href}>
              <span className={portal.rowIcon}>
                <PortalIcon name="paper" />
              </span>
              <span className={portal.rowMain}>
                <span className={portal.rowTitle}>{presentation.title}</span>
                <span className={portal.rowMeta}>{presentation.subtitle || presentation.eyebrow}</span>
              </span>
              <span className={portal.rowEnd}>
                <span className={portal.pill}>Edited {formatDay(presentation.updatedAt.slice(0, 10))}</span>
                <svg className={portal.chevron} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </span>
            </Link>
          </li>
        </ul>
      ) : (
        <p className={detail.muted}>
          No presentation yet. A presentation is a set of slides on this site for a prospective offtaker, filled in from
          its figures, that anyone who can open the deployment can download.
        </p>
      )}
    </section>
  );
}

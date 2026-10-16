import type { ReactElement } from "react";
import Link from "next/link";
import { formatDay } from "@/features/deployments/format";
import type { Deployment } from "@/features/deployments/types";
import { PortalIcon } from "@/features/portal/icons";
import portal from "@/features/portal/portal.module.css";
import type { Teaser } from "./types";

const Chevron = () => (
  <svg className={portal.chevron} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

/** One row per teaser: its name and headline, the deployment it came from, and when it was last edited. */
export function TeaserList({ teasers }: { teasers: readonly Teaser[] }): ReactElement {
  return (
    <ul className={portal.list}>
      {teasers.map((t) => (
        <li key={t.id}>
          <Link className={portal.row} href={`/portal/deployments/teasers/${t.id}`}>
            <span className={portal.rowIcon}>
              <PortalIcon name="paper" />
            </span>
            <span className={portal.rowMain}>
              <span className={portal.rowTitle}>{t.name}</span>
              <span className={portal.rowMeta}>{[t.headline, t.deploymentName].filter(Boolean).join(" · ")}</span>
            </span>
            <span className={portal.rowEnd}>
              <span className={portal.pill}>Edited {formatDay(t.updatedAt.slice(0, 10))}</span>
              <Chevron />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Deployments to start a teaser from. */
export function DeploymentPicker({ deployments }: { deployments: readonly Deployment[] }): ReactElement {
  return (
    <ul className={portal.list}>
      {deployments.map((d) => (
        <li key={d.id}>
          <Link className={portal.row} href={`/portal/deployments/teasers/new?deployment=${d.id}`}>
            <span className={portal.rowIcon}>
              <PortalIcon name="deployments" />
            </span>
            <span className={portal.rowMain}>
              <span className={portal.rowTitle}>{d.name}</span>
              <span className={portal.rowMeta}>{d.city ?? d.address?.split("\n")[0] ?? "No address yet"}</span>
            </span>
            <span className={portal.rowEnd}>
              <Chevron />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

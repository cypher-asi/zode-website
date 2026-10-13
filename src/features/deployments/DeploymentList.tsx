import type { ReactElement } from "react";
import Link from "next/link";
import { PortalIcon } from "@/features/portal/icons";
import portal from "@/features/portal/portal.module.css";
import { formatCount, formatDay } from "./format";
import {
  coolingLabel,
  networkingLabel,
  nextPhase,
  platformLabel,
  statusLabel,
  totalsOf,
  type Deployment,
} from "./types";

/** One row per deployment: its size and build, where it is, and its next RFS. Each opens the deployment. */
export function DeploymentList({
  deployments,
  today,
}: {
  deployments: readonly Deployment[];
  today: string;
}): ReactElement {
  return (
    <ul className={portal.list}>
      {deployments.map((d) => {
        const next = nextPhase(d.phases, today);
        return (
          <li key={d.id}>
            <Link className={portal.row} href={`/portal/deployments/${d.id}`} data-order="">
              <span className={portal.rowIcon}>
                <PortalIcon name="deployments" />
              </span>
              <span className={portal.rowMain}>
                <span className={portal.rowTitle}>
                  {d.name} · {formatCount(totalsOf(d).gpus)} {platformLabel(d.platform)} GPUs
                </span>
                <span className={portal.rowMeta}>
                  {[
                    `${formatCount(d.nodes)} nodes`,
                    coolingLabel(d.cooling),
                    networkingLabel(d.networking),
                    d.address?.split("\n")[0],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className={portal.rowEnd}>
                {next ? <span className={portal.pill}>RFS {formatDay(next.rfsOn)}</span> : null}
                <span className={portal.pill} data-strong={d.status === "active" ? "" : undefined}>
                  {statusLabel(d.status)}
                </span>
                <svg className={portal.chevron} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

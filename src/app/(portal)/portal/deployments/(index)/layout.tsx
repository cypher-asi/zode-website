import type { ReactElement } from "react";
import { DeploymentsHeader } from "@/features/deployments/DeploymentsIndex";
import styles from "@/features/portal/portal.module.css";

/** The Deployments header over its Active and All tabs; a deployment's own pages have their own. */
export default function DeploymentsLayout({ children }: LayoutProps<"/portal/deployments">): ReactElement {
  return (
    <div className={styles.page}>
      <DeploymentsHeader />
      {children}
    </div>
  );
}

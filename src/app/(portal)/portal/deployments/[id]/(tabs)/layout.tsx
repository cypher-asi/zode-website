import { Suspense, type ReactElement } from "react";
import { DeploymentHeader } from "@/features/deployments/DeploymentHeader";
import { PortalLoadingHeader } from "@/features/portal/PortalLoading";
import styles from "@/features/portal/portal.module.css";

/** A deployment's header over its Summary and BOM tabs, staying put as they swap beneath it. */
export default function DeploymentTabsLayout({ children, params }: LayoutProps<"/portal/deployments/[id]">): ReactElement {
  return (
    <div className={styles.page}>
      <Suspense fallback={<PortalLoadingHeader />}>
        <Header params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function Header({ params }: Pick<LayoutProps<"/portal/deployments/[id]">, "params">): Promise<ReactElement> {
  const { id } = await params;
  return <DeploymentHeader id={id} />;
}

import type { ReactElement } from "react";
import { FactoryProvider } from "@/features/factory/FactoryProvider";

/** One simulation run and playhead shared by every flow's page; each page checks the viewer is on the team. */
export default function FactoryLayout({ children }: LayoutProps<"/portal/factory">): ReactElement {
  return <FactoryProvider>{children}</FactoryProvider>;
}

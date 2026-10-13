"use client";

import dynamic from "next/dynamic";
import { PortalLoading } from "@/features/portal/PortalLoading";

/** The editor, with TipTap, loads in the browser once the route's shell has painted. */
export const LazyPostEditor = dynamic(() => import("./PostEditor").then((mod) => mod.PostEditor), {
  ssr: false,
  loading: () => <PortalLoading header={false} />,
});

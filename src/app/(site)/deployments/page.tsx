import { redirect } from "next/navigation";
import { DEPLOYMENTS } from "@/content/deployments";

export default function DeploymentsIndexPage() {
  const first = DEPLOYMENTS[0];
  redirect(`/deployments/${first.id}`);
}

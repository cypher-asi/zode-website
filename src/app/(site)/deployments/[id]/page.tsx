import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeploymentsView } from "@/components/Deployments";
import { getDeploymentById } from "@/content/deployments";

interface DeploymentsDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DeploymentsDetailPage({
  params,
}: DeploymentsDetailPageProps) {
  const { id } = await params;
  const deployment = getDeploymentById(id);
  if (!deployment) notFound();

  return (
    <Suspense fallback={null}>
      <DeploymentsView deployment={deployment} />
    </Suspense>
  );
}

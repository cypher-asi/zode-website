import { getDeploymentFor } from "@/features/deployments/deployments";
import { todayIso } from "@/features/deployments/format";
import { presentationOf } from "@/features/presentations/content";
import { renderPresentationPdf } from "@/features/presentations/pdf";

export async function GET() {
  const deployment = await getDeploymentFor("93c54495-d6c8-411b-875b-743f1ede6292", { team: true, userId: "preview" });
  if (!deployment) return new Response("missing", { status: 404 });
  const bytes = await renderPresentationPdf(presentationOf(deployment), todayIso());
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": "application/pdf" } });
}

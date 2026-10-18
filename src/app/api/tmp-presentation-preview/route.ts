import { notFoundResponse } from "@/features/data-room/http";
import { DEFAULT_CONFIG } from "@/features/deployments/config/catalog";
import { todayIso } from "@/features/deployments/format";
import type { Deployment, Phase } from "@/features/deployments/types";
import { presentationOf } from "@/features/presentations/content";
import { renderPresentationPdf } from "@/features/presentations/pdf";
import { teamAccount } from "@/features/zrm/access";

const phase = (id: string, platform: Phase["platform"], nodes: number, mw: number, rfsOn: string, price: number | null): Phase => ({
  id,
  name: null,
  platform,
  startOn: null,
  rfsOn,
  nodes,
  mw,
  clusterConfig: null,
  clusterCopies: 1,
  configOverrides: {},
  priceGpuHr: price,
  termMonths: price ? 60 : null,
  depositPct: price ? 27.5 : null,
});

const FIXTURE: Deployment = {
  id: "preview",
  name: "Chicago · 801 S Canal",
  status: "planned",
  nodes: 1056,
  platform: "b300",
  cooling: "liquid_dtc",
  networking: "infiniband",
  storageTbPerNode: 0,
  configuration: DEFAULT_CONFIG,
  address: "801 S Canal St\nChicago, IL 60607",
  city: "Chicago",
  placeId: null,
  facility: "conversion",
  termMonths: null,
  priceGpuHr: null,
  depositPct: null,
  depositUsd: null,
  creditRating: null,
  locRequired: false,
  locYears: null,
  creditGuarantee: false,
  leaseGuarantee: false,
  notes: null,
  externalNotes: null,
  dataRoomId: null,
  dataRoomName: null,
  shareToken: null,
  access: "team",
  privateTo: null,
  docs: {
    teaser: { access: "deployment", token: null },
    presentation: { access: "deployment", token: null },
  },
  phases: [
    phase("p1", "b300", 256, 3.8, "2027-02-15", 4.5),
    phase("p2", "vera_rubin", 460, 11.5, "2027-08-31", null),
    phase("p3", "vera_rubin", 340, 8.5, "2027-12-31", null),
  ],
  updatedAt: new Date().toISOString(),
};

/** A presentation of a fixed Chicago deployment, for previewing slide changes. The ZODE team only. */
export async function GET() {
  if (!(await teamAccount())) return notFoundResponse();
  const bytes = await renderPresentationPdf(presentationOf(FIXTURE), todayIso());
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": "application/pdf" } });
}

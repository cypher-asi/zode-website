import "server-only";
import type { ReactElement } from "react";
import { CompanyPanel, OpportunityPanel, PersonPanel, SitePanel } from "./panels";
import {
  getCompanyDetail,
  getOpportunityDetail,
  getPersonDetail,
  getSiteDetail,
  type CompanyDetail,
  type OpportunityDetail,
  type PersonDetail,
  type SiteDetail,
} from "./queries";
import type { RecordKind } from "./types";

export type RecordData =
  | { kind: "people"; detail: PersonDetail }
  | { kind: "companies"; detail: CompanyDetail }
  | { kind: "opportunities"; detail: OpportunityDetail }
  | { kind: "sites"; detail: SiteDetail };

/** Everything the right pane shows for one record, or null when there's no such record. */
export async function loadRecord(kind: RecordKind, id: string): Promise<RecordData | null> {
  switch (kind) {
    case "people": {
      const detail = await getPersonDetail(id);
      return detail && { kind, detail };
    }
    case "companies": {
      const detail = await getCompanyDetail(id);
      return detail && { kind, detail };
    }
    case "opportunities": {
      const detail = await getOpportunityDetail(id);
      return detail && { kind, detail };
    }
    case "sites": {
      const detail = await getSiteDetail(id);
      return detail && { kind, detail };
    }
  }
}

/** The right pane for one record. */
export function RecordDetail({ record }: { record: RecordData }): ReactElement {
  switch (record.kind) {
    case "people":
      return <PersonPanel key={record.detail.person.id} {...record.detail} />;
    case "companies":
      return <CompanyPanel key={record.detail.company.id} {...record.detail} />;
    case "opportunities":
      return <OpportunityPanel key={record.detail.opportunity.id} {...record.detail} />;
    case "sites":
      return <SitePanel key={record.detail.site.id} {...record.detail} />;
  }
}

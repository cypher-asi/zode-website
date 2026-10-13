import "server-only";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import type { RefOptions } from "./fieldUi";
import { CompanyPanel, OpportunityPanel, PersonPanel } from "./panels";
import {
  activities,
  companyPeople,
  companyTypes,
  customFields,
  education,
  getCompany,
  getOpportunity,
  getPerson,
  listStages,
  listTypes,
  notes,
  referenceOptions,
  relatedOpportunities,
  workHistory,
} from "./queries";
import type { ZrmKind } from "./types";

export async function loadRefOptions(): Promise<RefOptions> {
  const [refs, stages] = await Promise.all([referenceOptions(), listStages()]);
  return { ...refs, stages };
}

/** The right pane for one record, or a 404 when there's no such record. */
export async function RecordDetail({ kind, id }: { kind: ZrmKind; id: string }): Promise<ReactElement> {
  switch (kind) {
    case "people": {
      const person = await getPerson(id);
      if (!person) notFound();
      const [types, work, schools, custom, opportunities, personNotes, options] = await Promise.all([
        companyTypes(person.company_id),
        workHistory(id),
        education(id),
        customFields("people", id),
        relatedOpportunities("person_id", id),
        notes("people", id),
        loadRefOptions(),
      ]);
      return (
        <PersonPanel
          key={id}
          person={person}
          types={types}
          work={work}
          education={schools}
          custom={custom}
          opportunities={opportunities}
          notes={personNotes}
          options={options}
        />
      );
    }
    case "companies": {
      const company = await getCompany(id);
      if (!company) notFound();
      const [types, allTypes, custom, people, opportunities, companyNotes, options] = await Promise.all([
        companyTypes(id),
        listTypes(),
        customFields("companies", id),
        companyPeople(id),
        relatedOpportunities("company_id", id),
        notes("companies", id),
        loadRefOptions(),
      ]);
      return (
        <CompanyPanel
          key={id}
          company={company}
          types={types}
          allTypes={allTypes}
          custom={custom}
          people={people}
          opportunities={opportunities}
          notes={companyNotes}
          options={options}
        />
      );
    }
    case "opportunities": {
      const opportunity = await getOpportunity(id);
      if (!opportunity) notFound();
      const [types, log, opportunityNotes, options] = await Promise.all([
        companyTypes(opportunity.company_id),
        activities(id),
        notes("opportunities", id),
        loadRefOptions(),
      ]);
      return (
        <OpportunityPanel
          key={id}
          opportunity={opportunity}
          types={types}
          activities={log}
          notes={opportunityNotes}
          options={options}
        />
      );
    }
  }
}

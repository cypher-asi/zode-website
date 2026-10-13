"use client";

import { useOptimistic, useTransition, type ReactElement } from "react";
import { Select } from "@/components/ui/Select";
import { setSiteStatusAction, setStageAction } from "./actions";
import { DetailShell } from "./DetailShell";
import { SECTIONS } from "./fields";
import { formatDate, formatSpan } from "./fieldUi";
import { ChildSection, FieldSection, RelatedSection, Section, TypeList, TypesSection } from "./sections";
import {
  formatMoney,
  formatMw,
  personName,
  recordHref,
  type Activity,
  type Company,
  type CustomField,
  type Education,
  type Note,
  type Opportunity,
  type Person,
  type RecordKind,
  type Related,
  type Site,
  type WorkExperience,
  type ZrmType,
} from "./types";
import { useZrm, ZrmLink } from "./ZrmProvider";
import styles from "./zrm.module.css";

function Fields({ kind, record }: { kind: RecordKind; record: { id: string } }) {
  return SECTIONS[kind].map((section) => (
    <FieldSection key={section.id} kind={kind} id={record.id} section={section} record={record} />
  ));
}

function CustomFields({ kind, id, items }: { kind: "people" | "companies"; id: string; items: readonly CustomField[] }) {
  return (
    <ChildSection
      title="Custom fields"
      child="custom"
      kind={kind}
      parentId={id}
      items={items}
      addLabel="Add field"
      noun="field"
      render={(field) => (
        <>
          <span className={styles.itemMeta}>{field.key}</span>
          <span className={styles.long}>{field.value}</span>
        </>
      )}
    />
  );
}

const newOpportunityHref = (params: Record<string, string | null>): string => {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return `/portal/zrm/opportunities/new?${query}`;
};

export function PersonPanel({
  person,
  types,
  work,
  education,
  custom,
  opportunities,
  sites,
  notes,
}: {
  person: Person;
  types: ZrmType[];
  work: WorkExperience[];
  education: Education[];
  custom: CustomField[];
  opportunities: Related[];
  sites: Related[];
  notes: Note[];
}): ReactElement {
  const name = personName(person);
  const role = person.title ?? person.headline ?? "";
  return (
    <DetailShell
      kind="people"
      id={person.id}
      name={name}
      active={person.active}
      notes={notes}
      subtitle={
        <>
          {role}
          {role && person.company_id ? " at " : null}
          {person.company_id ? <ZrmLink href={recordHref("companies", person.company_id)}>{person.company_name}</ZrmLink> : null}
        </>
      }
    >
      <Fields kind="people" record={person} />
      {person.company_id ? (
        <Section title="Type">
          <TypeList types={types} />
        </Section>
      ) : null}
      <ChildSection
        title="Experience"
        child="work"
        kind="people"
        parentId={person.id}
        items={work}
        addLabel="Add role"
        noun="role"
        render={(role) => (
          <>
            <span>{[role.title, role.company].filter(Boolean).join(" at ")}</span>
            <span className={styles.itemMeta}>{formatSpan(role.start_date, role.end_date)}</span>
          </>
        )}
      />
      <ChildSection
        title="Education"
        child="education"
        kind="people"
        parentId={person.id}
        items={education}
        addLabel="Add school"
        noun="school"
        render={(school) => (
          <>
            <span>{school.school}</span>
            <span className={styles.itemMeta}>
              {[[school.degree, school.field].filter(Boolean).join(", "), formatSpan(school.start_date, school.end_date)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </>
        )}
      />
      <CustomFields kind="people" id={person.id} items={custom} />
      <RelatedSection
        title="Opportunities"
        kind="opportunities"
        items={opportunities}
        addHref={newOpportunityHref({ person_id: person.id, company_id: person.company_id })}
      />
      {sites.length > 0 ? <RelatedSection title="Sites" kind="sites" items={sites} /> : null}
    </DetailShell>
  );
}

export function CompanyPanel({
  company,
  types,
  custom,
  people,
  opportunities,
  sites,
  notes,
}: {
  company: Company;
  types: ZrmType[];
  custom: CustomField[];
  people: Related[];
  opportunities: Related[];
  sites: Related[];
  notes: Note[];
}): ReactElement {
  const { data } = useZrm();
  const subtitle = [company.industry, [company.city, company.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  return (
    <DetailShell kind="companies" id={company.id} name={company.name} active={company.active} notes={notes} subtitle={subtitle}>
      <Fields kind="companies" record={company} />
      <TypesSection companyId={company.id} current={types} all={data.types} />
      <CustomFields kind="companies" id={company.id} items={custom} />
      <RelatedSection
        title="People"
        kind="people"
        items={people}
        addHref={`/portal/zrm/people/new?company_id=${company.id}`}
      />
      <RelatedSection
        title="Opportunities"
        kind="opportunities"
        items={opportunities}
        addHref={newOpportunityHref({ company_id: company.id })}
      />
      <RelatedSection title="Sites" kind="sites" items={sites} addHref={`/portal/capacity/sites/new?provider_company_id=${company.id}`} />
    </DetailShell>
  );
}

function StageSelect({ id, stageId }: { id: string; stageId: string }): ReactElement {
  const { data } = useZrm();
  const [optimistic, setOptimistic] = useOptimistic(stageId);
  const [, startTransition] = useTransition();
  return (
    <Select
      size="sm"
      className={styles.stage}
      aria-label="Stage"
      align="end"
      options={data.stages.map((stage) => ({ value: stage.id, label: stage.name }))}
      value={optimistic}
      onChange={(next) =>
        startTransition(async () => {
          setOptimistic(next);
          await setStageAction(id, next);
        })
      }
    />
  );
}

export function OpportunityPanel({
  opportunity,
  types,
  activities,
  notes,
}: {
  opportunity: Opportunity;
  types: ZrmType[];
  activities: Activity[];
  notes: Note[];
}): ReactElement {
  const o = opportunity;
  return (
    <DetailShell
      kind="opportunities"
      id={o.id}
      name={o.title}
      active={o.active}
      notes={notes}
      actions={<StageSelect id={o.id} stageId={o.stage_id} />}
      subtitle={
        <>
          {o.person_id ? <ZrmLink href={recordHref("people", o.person_id)}>{o.person_name}</ZrmLink> : null}
          {o.person_id && o.company_id ? " · " : null}
          {o.company_id ? <ZrmLink href={recordHref("companies", o.company_id)}>{o.company_name}</ZrmLink> : null}
          {o.value != null ? `${o.person_id || o.company_id ? " · " : ""}${formatMoney(o.value)}` : null}
        </>
      }
    >
      <Fields kind="opportunities" record={o} />
      {o.company_id ? (
        <Section title="Type">
          <TypeList types={types} />
        </Section>
      ) : null}
      <ChildSection
        title="Activities"
        child="activity"
        kind="opportunities"
        parentId={o.id}
        items={activities}
        addLabel="Log activity"
        noun="activity"
        render={(activity) => (
          <>
            <span>
              <strong>{activity.kind}</strong>
              {activity.note ? ` · ${activity.note}` : null}
            </span>
            <span className={styles.itemMeta}>{formatDate(activity.at)}</span>
          </>
        )}
      />
      <Section title="Timeline">
        <p className={styles.none}>
          Opened {formatDate(o.created_at)}, updated {formatDate(o.updated_at)}.
        </p>
      </Section>
    </DetailShell>
  );
}

function StatusSelect({ id, statusId }: { id: string; statusId: string }): ReactElement {
  const { data } = useZrm();
  const [optimistic, setOptimistic] = useOptimistic(statusId);
  const [, startTransition] = useTransition();
  return (
    <Select
      size="sm"
      className={styles.stage}
      aria-label="Status"
      align="end"
      options={data.statuses.map((status) => ({ value: status.id, label: status.name }))}
      value={optimistic}
      onChange={(next) =>
        startTransition(async () => {
          setOptimistic(next);
          await setSiteStatusAction(id, next);
        })
      }
    />
  );
}

export function SitePanel({ site, notes }: { site: Site; notes: Note[] }): ReactElement {
  return (
    <DetailShell
      kind="sites"
      id={site.id}
      name={site.name}
      active={site.active}
      notes={notes}
      actions={<StatusSelect id={site.id} statusId={site.status_id} />}
      subtitle={
        <>
          {site.address}
          {site.address && site.provider_company_id ? " · " : null}
          {site.provider_company_id ? (
            <ZrmLink href={recordHref("companies", site.provider_company_id)}>{site.provider_name}</ZrmLink>
          ) : null}
          {site.address || site.provider_company_id ? " · " : null}
          {formatMw(site.total_it_mw)}
        </>
      }
    >
      <Fields kind="sites" record={site} />
      <Section title="Timeline">
        <p className={styles.none}>
          Added {formatDate(site.created_at)}, updated {formatDate(site.updated_at)}.
        </p>
      </Section>
    </DetailShell>
  );
}

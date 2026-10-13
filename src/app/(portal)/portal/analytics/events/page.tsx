import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { Panel } from "@/features/analytics/BarList";
import { eventLabel, isAnalyticsEvent } from "@/features/analytics/events";
import { hrefWith, param, type SearchParams } from "@/features/analytics/filters";
import { formatValue } from "@/features/analytics/format";
import { DeleteGoalButton, GoalForm } from "@/features/analytics/GoalForm";
import { HowWeMeasure } from "@/features/analytics/HowWeMeasure";
import { loadEventProps, loadEvents, loadGoals } from "@/features/analytics/queries";
import { ANALYTICS_PATH, openReport } from "@/features/analytics/report";
import { Toolbar } from "@/features/analytics/Toolbar";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, PageHeader } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";
import a from "@/features/analytics/analytics.module.css";

export const metadata: Metadata = {
  title: "Events & goals | Analytics | ZODE",
  robots: { index: false, follow: false },
};

const PATH = `${ANALYTICS_PATH}/events`;

/** The conversions the team tracks, with their rates, and every event the site records. */
export default function AnalyticsEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader title="Events & goals" subtitle="Conversions and the actions visitors take on the way." />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Events searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Events({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<ReactElement> {
  const { filters, search } = await openReport(searchParams, PATH);
  const requested = param(search, "event");
  const selected = isAnalyticsEvent(requested) ? requested : null;
  const keep = { event: selected ?? undefined };

  let data;
  try {
    const [goals, events, props] = await Promise.all([
      loadGoals(filters),
      loadEvents(filters),
      selected ? loadEventProps(filters, selected) : null,
    ]);
    data = { goals, events, props };
  } catch (error) {
    console.error("[analytics] events failed", error);
  }
  if (!data) {
    return (
      <>
        <Toolbar path={PATH} filters={filters} keep={keep} />
        <Empty>The events couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      </>
    );
  }

  return (
    <>
      <Toolbar path={PATH} filters={filters} keep={keep} />
      <div className={a.panels}>
        <Panel title="Goals" wide>
          <div className={a.tableWrap}>
            <table className={a.table}>
              <thead>
                <tr>
                  <th scope="col">Goal</th>
                  <th scope="col">Completed by</th>
                  <th scope="col" title="Sessions that completed the goal at least once.">
                    Conversions
                  </th>
                  <th scope="col">Visitors</th>
                  <th scope="col" title="Every time it was completed.">
                    Completions
                  </th>
                  <th scope="col" title="Converted sessions divided by all sessions in the range.">
                    Conversion rate
                  </th>
                  <th scope="col" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.goals.length ? (
                  data.goals.map((row) => (
                    <tr key={row.goal.id}>
                      <td>{row.goal.label}</td>
                      <td className={a.muted}>
                        {row.goal.matchKind === "event" ? eventLabel(row.goal.match) : `Visiting ${row.goal.match}`}
                      </td>
                      <td>{formatValue(row.conversions, "count")}</td>
                      <td>{formatValue(row.visitors, "count")}</td>
                      <td>{formatValue(row.completions, "count")}</td>
                      <td>{formatValue(row.conversionRate, "percent")}</td>
                      <td>
                        <DeleteGoalButton id={row.goal.id} label={row.goal.label} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={a.muted} colSpan={7}>
                      No goals yet. Add one below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <GoalForm />
        </Panel>

        <Panel title="Events" wide>
          <div className={a.tableWrap}>
            <table className={a.table}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Total</th>
                  <th scope="col">Visitors</th>
                  <th scope="col">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.events.length ? (
                  data.events.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <Link
                          className={a.cellLink}
                          href={hrefWith(PATH, filters, {}, { event: selected === row.name ? null : row.name })}
                          aria-current={selected === row.name ? "true" : undefined}
                          scroll={false}
                        >
                          {eventLabel(row.name)}
                        </Link>
                        <span className={a.cellMeta}>{row.name}</span>
                      </td>
                      <td>{formatValue(row.total, "count")}</td>
                      <td>{formatValue(row.visitors, "count")}</td>
                      <td>{formatValue(row.sessions, "count")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={a.muted} colSpan={4}>
                      No events in this range yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && data.props ? (
          <Panel title={`${eventLabel(selected)} details`} wide>
            <div className={a.tableWrap}>
              <table className={a.table}>
                <thead>
                  <tr>
                    <th scope="col">Value</th>
                    <th scope="col">Property</th>
                    <th scope="col">Total</th>
                    <th scope="col">Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.props.length ? (
                    data.props.map((row) => (
                      <tr key={`${row.key}:${row.value}`}>
                        <td title={row.value}>{row.value}</td>
                        <td className={a.muted}>{row.key}</td>
                        <td>{formatValue(row.total, "count")}</td>
                        <td>{formatValue(row.visitors, "count")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={a.muted} colSpan={4}>
                        This event has no details recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>
      <HowWeMeasure />
    </>
  );
}

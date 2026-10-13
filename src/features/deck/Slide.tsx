import Image from "next/image";
import Link from "next/link";
import { useId, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { CabinArt, VIEW as CABIN_VIEW } from "@/features/zode-drawings/CabinArt";
import { PRINCIPLE_GRID_CLASS, PrincipleCard } from "@/features/home/principles/Principles";
import { PRINCIPLES } from "@/features/home/principles/principles";
import { ANCHOR_X, StackArt, VIEW as STACK_VIEW, labelY } from "@/features/home/stack/StackArt";
import stackStyles from "@/features/home/stack/FullStack.module.css";
import { MacroArt } from "./art/MacroArt";
import { DEMAND_GAP, DemandChart } from "./charts/DemandChart";
import { ShortfallByYear, ShortfallChart } from "./charts/ShortfallChart";
import { StateTileMap } from "./charts/StateTileMap";
import { TokenChart } from "./charts/TokenChart";
import { BLOCKED, NEWS } from "./news";
import {
  AS_OF,
  COUNTY_PAUSES,
  MARKET_TIGHTNESS,
  POLICY_STATS,
  SOURCES,
  STATE_ACTIONS,
  STATUS_LABELS,
  type Source,
  type SourceId,
  type StateStatus,
} from "./research";
import type { Slide, Stat } from "./slides";
import styles from "./Slide.module.css";

type Of<K extends Slide["kind"]> = Extract<Slide, { kind: K }>;

const noop = () => {};

/** Staggers a block's entrance after the slide becomes active. */
const rise = (d: number) => ({ className: styles.rise, style: { "--d": d } as CSSProperties });

function cite(source: Source): string {
  return `${source.publisher}${source.via ? ` (${source.via})` : ""}, ${source.date}`;
}

function SourceLine({ ids }: { ids: readonly SourceId[] }): ReactElement {
  return (
    <p className={styles.sources}>
      {ids.map((id, i) => {
        const source: Source = SOURCES[id];
        return (
          <span key={id}>
            {i ? "; " : null}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {cite(source)}
              </a>
            ) : (
              cite(source)
            )}
          </span>
        );
      })}
      .
    </p>
  );
}

function StatBlock({ stat, highlight = false, size = "md" }: { stat: Stat; highlight?: boolean; size?: "md" | "lg" | "xl" }): ReactElement {
  return (
    <div className={styles.stat} data-size={size}>
      <span className={styles.statValue} data-highlight={highlight || undefined}>
        {stat.value}
      </span>
      <span className={styles.statLabel}>{stat.label}</span>
    </div>
  );
}

function Cover({ slide }: { slide: Of<"cover"> }): ReactElement {
  return (
    <div className={styles.cover}>
      <div className={styles.coverText}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the SVG wordmark scales with the slide */}
        <img className={styles.printMark} src="/brand/zode-wordmark-white.svg" alt="ZODE" />
        <div>
          <h2 {...rise(1)} className={`${styles.rise} ${styles.display} ${styles.coverTitle}`}>
            {slide.title}
          </h2>
          <p {...rise(2)} className={`${styles.rise} ${styles.coverLede}`}>
            {slide.lede}
          </p>
        </div>
      </div>
      <div className={styles.coverImage} data-media data-surface="light">
        <Image
          src={slide.image}
          alt="A ZODE in a calm, daylit setting"
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 900px) 50vw, 40vw"
          loading="eager"
        />
      </div>
    </div>
  );
}

/**
 * The macro slide, two thirds and one: on the left a quadrant, a card per
 * figure with its drawing and token growth charted full bleed; on the right the
 * supply chain from capital to offtake as rows, its bottleneck blinking red,
 * then the statement.
 */
function Stats({ slide, active, compact }: { slide: Of<"stats">; active: boolean; compact: boolean }): ReactElement {
  return (
    <div className={styles.macro}>
      <div className={styles.macroLead}>
        <ul className={styles.macroCards}>
          {slide.stats.map((stat, i) => (
            <li key={stat.label} {...rise(2 + i * 0.5)} className={`${styles.rise} ${styles.macroCard}`}>
              <div className={styles.macroText}>
                <span className={styles.label}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.macroValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
              <div className={styles.macroFigure}>
                <MacroArt id={stat.art} playing={active} />
              </div>
            </li>
          ))}
          <li {...rise(2 + slide.stats.length * 0.5)} className={`${styles.rise} ${styles.trendCard}`}>
            <div className={styles.trendChart}>
              <TokenChart active={active} compact={compact} />
            </div>
            <p className={styles.trendCaption}>
              <span>{String(slide.stats.length + 1).padStart(2, "0")}</span>
              {slide.trend}
            </p>
          </li>
        </ul>
      </div>
      <div className={styles.macroChain}>
        <p {...rise(3)} className={`${styles.rise} ${styles.label}`}>
          Supply chain
        </p>
        <ol className={styles.chain}>
          {slide.chain.map((step, i) => (
            <li
              key={step.label}
              {...rise(3.5 + i * 0.4)}
              className={`${styles.rise} ${styles.chainStep}`}
              data-hard={step.hard || undefined}
            >
              <span className={styles.label}>{String(i + 1).padStart(2, "0")}</span>
              <div className={styles.chainFigure}>
                <MacroArt id={step.art} hard={step.hard} playing={active} />
              </div>
              <span className={styles.chainText}>
                <span className={styles.chainLabel}>{step.label}</span>
                {step.hard ? <span className={styles.chainNote}>Bottleneck</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <h3 {...rise(6)} className={`${styles.rise} ${styles.h3} ${styles.macroStatement}`}>
          {slide.statement}
        </h3>
      </div>
    </div>
  );
}

function Demand({ active, compact }: { active: boolean; compact: boolean }): ReactElement {
  return (
    <div className={styles.chartBody}>
      <figure {...rise(2)} className={`${styles.rise} ${styles.figure}`}>
        <DemandChart active={active} compact={compact} />
        <figcaption className={styles.legend}>
          <span className={styles.key} data-key="line">
            Forecast US data center capacity, BNEF base case
          </span>
          <span className={styles.key} data-key="dashed">
            Installed base growing at the grid&rsquo;s record 10 GW a year (illustrative, ZODE)
          </span>
          <span className={styles.key} data-key="gap">
            {compact ? `The gap: ${DEMAND_GAP} GW by 2035` : "The gap"}
          </span>
        </figcaption>
      </figure>
      <aside className={styles.side}>
        <h3 {...rise(3)} className={`${styles.rise} ${styles.label}`}>
          Market tightness
        </h3>
        {MARKET_TIGHTNESS.map((item, i) => (
          <div key={item.label} {...rise(4 + i)}>
            <StatBlock stat={item} />
            <span className={styles.statSource}>{item.source}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}

function Shortfall({ active, compact }: { active: boolean; compact: boolean }): ReactElement {
  return (
    <div className={styles.chartBody} data-split="wide">
      <figure {...rise(2)} className={`${styles.rise} ${styles.figure}`}>
        <ShortfallChart active={active} compact={compact} />
        <figcaption className={styles.caption}>
          US data center power, 2026–2028, GW. Fixes are probability-weighted; midpoint case.
        </figcaption>
      </figure>
      <figure {...rise(3)} className={`${styles.rise} ${styles.figure}`}>
        <ShortfallByYear active={active} compact={compact} />
        <figcaption className={styles.caption}>Cumulative net gap, GW. *2029 extends the forecast.</figcaption>
      </figure>
    </div>
  );
}

const STATUS_ORDER: readonly StateStatus[] = ["enacted", "executive", "introduced", "failed"];

function States({ active, compact }: { active: boolean; compact: boolean }): ReactElement {
  const counts = Object.values(STATE_ACTIONS).reduce<Partial<Record<StateStatus, number>>>((acc, { status }) => {
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className={styles.chartBody} data-split="map">
      <figure {...rise(2)} className={`${styles.rise} ${styles.figure} ${styles.map}`}>
        <StateTileMap active={active} compact={compact} />
      </figure>
      <aside className={styles.side}>
        <ul {...rise(3)} className={`${styles.rise} ${styles.statusList}`}>
          {STATUS_ORDER.map((status) => (
            <li key={status} className={styles.status} data-status={status}>
              <span className={styles.swatch} aria-hidden="true" />
              <span>{STATUS_LABELS[status]}</span>
              <span className={styles.count}>{counts[status] ?? 0}</span>
            </li>
          ))}
          <li className={styles.status} data-status="county">
            <span className={styles.swatch} aria-hidden="true" />
            <span>County pause this fall</span>
            <span className={styles.count}>{COUNTY_PAUSES.length}</span>
          </li>
        </ul>
        {POLICY_STATS.map((item, i) => (
          <div key={item.label} {...rise(4 + i)}>
            <StatBlock stat={item} />
            <span className={styles.statSource}>{item.source}</span>
          </div>
        ))}
        <p {...rise(6)} className={`${styles.rise} ${styles.fine}`}>
          New York&rsquo;s order covers data centers of 50 MW or more.{compact ? null : " Hover a state for its bill."}{" "}
          As of {AS_OF}.
        </p>
      </aside>
    </div>
  );
}

function News({ slide }: { slide: Of<"news"> }): ReactElement {
  return (
    <div className={styles.newsBody}>
      <div className={styles.newsLead}>
        <div {...rise(2)}>
          <StatBlock stat={BLOCKED} highlight size="xl" />
          <span className={styles.statSource}>{BLOCKED.detail} · Data Center Watch</span>
        </div>
        <p {...rise(3)} className={`${styles.rise} ${styles.takeaway}`}>
          {slide.takeaway}
        </p>
      </div>
      <ul className={styles.newsGrid}>
        {NEWS.map((item, i) => (
          <li key={item.url} {...rise(3 + i * 0.5)}>
            <a className={styles.newsCard} href={item.url} target="_blank" rel="noreferrer noopener">
              <span className={styles.newsPlace}>{item.place}</span>
              <h3 className={styles.h3}>{item.headline}</h3>
              <span className={styles.newsSummary}>{item.summary}</span>
              <span className={styles.newsMeta}>
                {item.outlet} · {item.date}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Columns({ slide }: { slide: Of<"columns"> }): ReactElement {
  return (
    <div className={styles.statsBody}>
      <div className={styles.columns}>
        {slide.columns.map((column, i) => (
          <div key={column.label} {...rise(2 + i)} className={`${styles.rise} ${styles.column}`}>
            <p className={styles.label}>{column.label}</p>
            <h3 className={styles.h3}>{column.title}</h3>
            <p className={styles.body}>{column.body}</p>
          </div>
        ))}
      </div>
      <p {...rise(5)} className={`${styles.rise} ${styles.statement}`}>
        {slide.statement}
      </p>
    </div>
  );
}

function Solution({ slide, active }: { slide: Of<"solution">; active: boolean }): ReactElement {
  return (
    <div className={styles.solution}>
      <div className={styles.cabinRow}>
        <figure
          className={styles.cabin}
          data-shown={active || undefined}
          style={{ "--ratio": CABIN_VIEW.w / CABIN_VIEW.h } as CSSProperties}
        >
          <div className={styles.cabinArt}>
            <CabinArt pod="compute" active={null} onActive={noop} />
          </div>
          <figcaption className={styles.figLabel}>FIG. 01 — ZODE, compute pod</figcaption>
        </figure>
        <ul className={styles.facts}>
          {slide.facts.map((fact, i) => (
            <li key={fact.label} {...rise(3 + i)} className={`${styles.rise} ${styles.fact}`}>
              <span className={styles.factValue}>{fact.value}</span>
              <span className={styles.factLabel}>{fact.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`${PRINCIPLE_GRID_CLASS} ${styles.principles}`} data-shown={active || undefined}>
        {PRINCIPLES.map((principle, i) => (
          <PrincipleCard key={principle.id} principle={principle} index={i} open playing={active} headingLevel={3} />
        ))}
      </div>
    </div>
  );
}

function Stack({ slide, active }: { slide: Of<"stack">; active: boolean }): ReactElement {
  const anchorX = ((ANCHOR_X - STACK_VIEW.x) / STACK_VIEW.w) * 100;
  return (
    <div className={styles.stack}>
      <p {...rise(2)} className={`${styles.rise} ${styles.lede}`}>
        {slide.lede}
      </p>
      <div className={styles.stackFigure} style={{ "--ratio": STACK_VIEW.w / STACK_VIEW.h } as CSSProperties}>
        <div className={stackStyles.figure} data-exploded={active || undefined}>
          <StackArt active={null} onActive={noop} />
        </div>
        <ol className={styles.stackLabels}>
          {slide.layers.map((layer, i) => (
            <li
              key={layer.title}
              className={`${styles.rise} ${styles.stackLabel}`}
              style={
                {
                  "--d": 3 + i * 0.5,
                  "--x": `${anchorX}%`,
                  "--y": `${((labelY(i) - STACK_VIEW.y) / STACK_VIEW.h) * 100}%`,
                } as CSSProperties
              }
            >
              <span className={styles.label}>{layer.index}</span>
              <span className={styles.stackTitle}>{layer.title}</span>
              <span className={styles.stackBody}>{layer.body}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Steps({ slide }: { slide: Of<"steps"> }): ReactElement {
  return (
    <div className={styles.statsBody}>
      <ol className={styles.steps}>
        {slide.steps.map((step, i) => (
          <li key={step.title} {...rise(2 + i)} className={`${styles.rise} ${styles.step}`}>
            <span className={styles.label}>Step {String(i + 1).padStart(2, "0")}</span>
            <h3 className={styles.h3}>{step.title}</h3>
            <p className={styles.body}>{step.body}</p>
          </li>
        ))}
      </ol>
      <p {...rise(6)} className={`${styles.rise} ${styles.statement}`}>
        {slide.statement}
      </p>
    </div>
  );
}

function Unit({ slide }: { slide: Of<"unit"> }): ReactElement {
  return (
    <div className={styles.unit}>
      <div className={styles.specGrid}>
        {slide.specs.map((spec, i) => (
          <div key={spec.label} {...rise(2 + i * 0.5)}>
            <StatBlock stat={spec} highlight={i === slide.highlight} />
          </div>
        ))}
      </div>
      <figure {...rise(3)} className={`${styles.rise} ${styles.render}`}>
        <div className={styles.renderImage} data-media>
          <Image
            src={slide.image}
            alt="A cutaway render of a ZODE's interior"
            fill
            sizes="(max-width: 700px) 100vw, 40vw"
            loading="eager"
          />
        </div>
        <figcaption className={styles.figLabel}>FIG. 02 — ZODE, cutaway</figcaption>
      </figure>
    </div>
  );
}

function Traction({ slide }: { slide: Of<"traction"> }): ReactElement {
  return (
    <div className={styles.split}>
      <div className={styles.heroPair}>
        <div {...rise(2)}>
          <StatBlock stat={slide.hero} highlight size="xl" />
        </div>
        <div {...rise(2.5)} className={`${styles.rise} ${styles.heroPlus}`}>
          <span className={styles.plusSign} aria-hidden="true">
            +
          </span>
          <StatBlock stat={slide.plus} size="lg" />
        </div>
      </div>
      <div className={styles.splitSide}>
        <dl className={styles.details}>
          {slide.details.map((row, i) => (
            <div key={row.label} {...rise(3 + i * 0.5)} className={`${styles.rise} ${styles.detail}`}>
              <dt className={styles.label}>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.notes}>
          {slide.notes.map((note, i) => (
            <p key={note.title} {...rise(6 + i)} className={`${styles.rise} ${styles.body}`}>
              <strong className={styles.strong}>{note.title}</strong> {note.body}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pipeline({ slide }: { slide: Of<"pipeline"> }): ReactElement {
  return (
    <div className={styles.split} data-split="table">
      <table {...rise(2)} className={`${styles.rise} ${styles.table}`}>
        <thead>
          <tr>
            <th scope="col">Site</th>
            <th scope="col">Path</th>
            <th scope="col" data-num>
              IT MW
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {slide.rows.map((row) => (
            <tr key={row.site}>
              <th scope="row">{row.site}</th>
              <td>{row.path}</td>
              <td data-num>{row.mw}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td />
            <td data-num>{slide.total}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <div className={styles.splitSide}>
        {slide.stats.map((stat, i) => (
          <div key={stat.label} {...rise(3 + i)}>
            <StatBlock stat={stat} size="lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Market({ slide }: { slide: Of<"market"> }): ReactElement {
  return (
    <div className={styles.split}>
      <div {...rise(2)}>
        <StatBlock stat={slide.hero} highlight size="xl" />
      </div>
      <div className={styles.splitSide}>
        {slide.stats.map((stat, i) => (
          <div key={stat.label} {...rise(3 + i)}>
            <StatBlock stat={stat} size="lg" />
          </div>
        ))}
        <div {...rise(5)} className={`${styles.rise} ${styles.callout}`}>
          <span className={styles.calloutValue}>{slide.callout.value}</span>
          <span className={styles.body}>{slide.callout.label}</span>
        </div>
      </div>
    </div>
  );
}

function Comparison({ slide }: { slide: Of<"comparison"> }): ReactElement {
  return (
    <div className={styles.statsBody}>
      <table {...rise(2)} className={`${styles.rise} ${styles.table} ${styles.compare}`}>
        <thead>
          <tr>
            <td />
            <th scope="col">{slide.columns[0]}</th>
            <th scope="col" data-us>
              {slide.columns[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {slide.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.them}</td>
              <td data-us>{row.us}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p {...rise(3)} className={`${styles.rise} ${styles.fine}`}>
        {slide.note}
      </p>
    </div>
  );
}

function Finance({ slide }: { slide: Of<"finance"> }): ReactElement {
  return (
    <div className={styles.split} data-split="even">
      <ol className={styles.capital}>
        {slide.stack.map((layer, i) => (
          <li key={layer.label} {...rise(2 + i * 0.5)} className={`${styles.rise} ${styles.capitalLayer}`} data-tier={i}>
            <span className={styles.capitalLabel}>{layer.label}</span>
            <span className={styles.capitalValue}>{layer.value}</span>
          </li>
        ))}
      </ol>
      <div {...rise(4)} className={`${styles.rise} ${styles.example}`}>
        <h3 className={styles.label}>{slide.example.title}</h3>
        <dl className={styles.details}>
          {slide.example.rows.map((row) => (
            <div key={row.label} className={styles.detail}>
              <dt>{row.label}</dt>
              <dd className={styles.exampleValue}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.fine}>{slide.example.note}</p>
      </div>
    </div>
  );
}

function Raise({ slide }: { slide: Of<"raise"> }): ReactElement {
  return (
    <div className={styles.split}>
      <div className={styles.raiseLead}>
        <div {...rise(2)}>
          <StatBlock stat={slide.hero} highlight size="xl" />
        </div>
        <ul {...rise(3)} className={`${styles.rise} ${styles.terms}`}>
          {slide.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>
      <div {...rise(4)} className={`${styles.rise} ${styles.splitSide}`}>
        <h3 className={styles.label}>Use of funds</h3>
        <ul className={styles.uses}>
          {slide.uses.map((use) => (
            <li key={use}>{use}</li>
          ))}
          <li className={styles.usesTotal}>
            <span>Total</span>
            <span>{slide.total}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Team({ slide }: { slide: Of<"team"> }): ReactElement {
  return (
    <div className={styles.split} data-split="even">
      <div {...rise(2)} className={styles.rise}>
        <p className={styles.label}>{slide.founder.role}</p>
        <h3 className={`${styles.h3} ${styles.person}`}>{slide.founder.name}</h3>
      </div>
      <ul {...rise(3)} className={`${styles.rise} ${styles.credits}`}>
        {slide.founder.credits.map((credit) => (
          <li key={credit}>{credit}</li>
        ))}
      </ul>
    </div>
  );
}

function Close({ slide }: { slide: Of<"close"> }): ReactElement {
  return (
    <div className={styles.close}>
      <h2 {...rise(1)} className={`${styles.rise} ${styles.display} ${styles.closeTitle}`}>
        {slide.title}
      </h2>
      <p {...rise(2)} className={`${styles.rise} ${styles.coverLede}`}>
        {slide.lede}
      </p>
      <div {...rise(3)} className={`${styles.rise} ${styles.actions}`}>
        <Link className={styles.primary} href="/talk-to-an-engineer" scroll={false}>
          Talk to an engineer
        </Link>
        <Link className={styles.secondary} href="/buy-compute">
          Buy compute
        </Link>
      </div>
      <p {...rise(4)} className={`${styles.rise} ${styles.meta}`}>
        <a href="mailto:hello@zode.org">{slide.contact}</a>
      </p>
    </div>
  );
}

const SOURCE_GROUPS: readonly { title: string; ids: readonly SourceId[] }[] = [
  { title: "Demand and supply", ids: ["bnef", "utilityDive", "epri", "morganStanley", "cbre", "jll", "capex", "zodePricing", "googleTokens", "goldmanTokens"] },
  { title: "Policy", ids: ["ncsl", "newYork", "oregon", "dataCenterWatch"] },
];

function Sources(): ReactElement {
  return (
    <div className={styles.sourcesBody}>
      {SOURCE_GROUPS.map((group, g) => (
        <div key={group.title} {...rise(2 + g)} className={styles.rise}>
          <h3 className={styles.label}>{group.title}</h3>
          <ol className={styles.citations}>
            {group.ids.map((id) => {
              const source: Source = SOURCES[id];
              return (
                <li key={id}>
                  <span className={styles.citePublisher}>{source.publisher}</span>{" "}
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer noopener">
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                  , {source.date}
                  {source.via ? ` (${source.via})` : null}.
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      <div {...rise(4)} className={styles.rise}>
        <h3 className={styles.label}>News</h3>
        <ol className={styles.citations}>
          {NEWS.map((item) => (
            <li key={item.url}>
              <span className={styles.citePublisher}>{item.outlet}</span>{" "}
              <a href={item.url} target="_blank" rel="noreferrer noopener">
                {item.headline}
              </a>
              , {item.date}.
            </li>
          ))}
        </ol>
        <p className={styles.fine}>
          As of {AS_OF}. The dashed grid line on the demand chart is ZODE&rsquo;s illustration, not a third-party forecast.
          Pipeline, contract and financing figures are ZODE&rsquo;s own and preliminary where noted.
        </p>
      </div>
    </div>
  );
}

function Body({ slide, active, compact }: { slide: Slide; active: boolean; compact: boolean }): ReactNode {
  switch (slide.kind) {
    case "cover":
      return <Cover slide={slide} />;
    case "stats":
      return <Stats slide={slide} active={active} compact={compact} />;
    case "demand":
      return <Demand active={active} compact={compact} />;
    case "shortfall":
      return <Shortfall active={active} compact={compact} />;
    case "states":
      return <States active={active} compact={compact} />;
    case "news":
      return <News slide={slide} />;
    case "columns":
      return <Columns slide={slide} />;
    case "solution":
      return <Solution slide={slide} active={active} />;
    case "stack":
      return <Stack slide={slide} active={active} />;
    case "steps":
      return <Steps slide={slide} />;
    case "unit":
      return <Unit slide={slide} />;
    case "traction":
      return <Traction slide={slide} />;
    case "pipeline":
      return <Pipeline slide={slide} />;
    case "market":
      return <Market slide={slide} />;
    case "comparison":
      return <Comparison slide={slide} />;
    case "finance":
      return <Finance slide={slide} />;
    case "raise":
      return <Raise slide={slide} />;
    case "team":
      return <Team slide={slide} />;
    case "close":
      return <Close slide={slide} />;
    case "sources":
      return <Sources />;
  }
}

/** Slides that lay out their own title, without the head band. */
const NO_HEAD = new Set<Slide["kind"]>(["cover", "close"]);
/** And the close runs full bleed with the rails alone; the cover keeps its foot band for the company line. */
const NO_FOOT = new Set<Slide["kind"]>(["close"]);

export const hasHead = (slide: Slide): boolean => !NO_HEAD.has(slide.kind);

/**
 * A slide's sources, folded behind a label at the foot: hovering or focusing
 * it opens them above, and a click pins them open where there's no hover.
 * Printed, and on a story card (`inline`), they set out in the foot in full.
 */
function FootSources({ ids, inline }: { ids: readonly SourceId[]; inline: boolean }): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (inline) {
    return (
      <div className={styles.footSources} data-inline="">
        <span className={styles.sourcesToggle}>Sources</span>
        <SourceLine ids={ids} />
      </div>
    );
  }
  return (
    <div className={styles.footSources} data-open={open || undefined}>
      <button
        type="button"
        className={styles.sourcesToggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        Sources
      </button>
      <div id={id} className={styles.sourcesPanel}>
        <SourceLine ids={ids} />
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * One 16:9 slide. Everything is sized in container units of the stage, so a
 * slide reads the same full-screen, in the overview and on a printed page.
 * Content slides share one page grid: a head band with the title, the body,
 * and a foot band with the section name, logos, sources and page number.
 * `grid` draws the rails and rules on the slide itself; the stage turns it
 * off and draws one shared grid over every slide instead, finding the bands
 * by `data-band`. `active` plays its entrance; `branded` adds the wordmark to
 * its foot for print, where the site header isn't on the page. `compact`
 * reflows it as a phone's story card: one column at the site's mobile type
 * sizes, scrolling where it runs long.
 */
export function SlideView({
  slide,
  index,
  total,
  active,
  branded = false,
  grid = true,
  compact = false,
}: {
  slide: Slide;
  index: number;
  total: number;
  active: boolean;
  branded?: boolean;
  grid?: boolean;
  compact?: boolean;
}): ReactElement {
  const head = hasHead(slide);
  const foot = !NO_FOOT.has(slide.kind);
  const dark = slide.ground === "ink";
  const mark = branded ? (
    // eslint-disable-next-line @next/next/no-img-element -- the SVG wordmark scales with the slide
    <img
      className={styles.footMark}
      src={dark ? "/brand/zode-wordmark-white.svg" : "/brand/zode-wordmark-black.svg"}
      alt="ZODE"
    />
  ) : null;
  return (
    <div
      className={styles.slide}
      data-ground={slide.ground}
      data-kind={slide.kind}
      data-active={active || undefined}
      data-compact={compact || undefined}
    >
      <div
        className={styles.frame}
        data-frame=""
        data-grid={grid || undefined}
        data-head={head || undefined}
        data-foot={foot || undefined}
      >
        {head ? (
          <header className={styles.head} data-band="head">
            <h2 {...rise(1)} className={`${styles.rise} ${styles.title}`}>
              {slide.title}
            </h2>
          </header>
        ) : null}
        <div className={styles.main}>
          <Body slide={slide} active={active} compact={compact} />
        </div>
        {!foot ? (
          mark && <footer className={styles.foot}>{mark}</footer>
        ) : (
          <footer className={styles.foot} data-band="foot">
            {head ? (
              <span className={styles.sectionName} data-band="name">
                {slide.eyebrow}
              </span>
            ) : null}
            {slide.kind === "cover" ? (
              <p className={styles.footLabel}>
                {slide.meta} · {slide.eyebrow}
              </p>
            ) : null}
            {slide.logos ? (
              <ul className={styles.logos}>
                {slide.logos.map((logo) => (
                  <li key={logo.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the SVG logos scale with the slide */}
                    <img src={logo.src} alt={logo.name} style={{ "--h": logo.height } as CSSProperties} />
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={styles.footEnd}>
              {slide.sources ? <FootSources ids={slide.sources} inline={compact} /> : null}
              <span className={styles.number}>
                {pad(index + 1)} / {pad(total)}
              </span>
              {slide.kind === "cover" ? null : mark}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

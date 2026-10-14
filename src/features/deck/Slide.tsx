import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { NorthAmericaFlags } from "@/components/ui/NorthAmericaFlags";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import { CabinArt, VIEW as CABIN_VIEW } from "@/features/zode-drawings/CabinArt";
import { Principles } from "@/features/home/principles/Principles";
import { StackFigure } from "@/features/home/stack/FullStack";
import { MacroArt } from "./art/MacroArt";
import { MemeTV } from "./art/MemeTV";
import { SiteMap } from "./art/SiteMap";
import { UnitIcon, type UnitIconId } from "./art/UnitIcon";
import { DEMAND_GAP, DemandChart } from "./charts/DemandChart";
import { ShortfallByYear, ShortfallChart } from "./charts/ShortfallChart";
import { StateTileMap } from "./charts/StateTileMap";
import { TokenChart } from "./charts/TokenChart";
import { DISCLAIMER, LEGAL_LEGEND, RAISE_NOTE } from "./disclaimer";
import { BLOCKED, NEWS } from "./news";
import { GRID_LABELS, STATUS_LABELS, STATUS_ORDER, type GridGate, type PolicyMap, type PolicyState } from "./policyTypes";
import { AS_OF, MARKET_TIGHTNESS, SOURCES, sourceUrl, type Source, type SourceId } from "./research";
import type { ContractSide, Logo, Slide, Stat } from "./slides";
import styles from "./Slide.module.css";

type Of<K extends Slide["kind"]> = Extract<Slide, { kind: K }>;

const noop = () => {};

/** Staggers a block's entrance after the slide becomes active. */
const rise = (d: number) => ({ className: styles.rise, style: { "--d": d } as CSSProperties });

function cite(source: Source): string {
  return `${source.publisher}${source.via ? ` (${source.via})` : ""}, ${source.date}`;
}

/** An inline citation, linked to its source when the source has a page. */
function Cited({ id, children }: { id: SourceId; children: ReactNode }): ReactElement {
  const url = sourceUrl(id);
  return url ? (
    <a className={styles.cited} href={url} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ) : (
    <>{children}</>
  );
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

/**
 * The cover's securities legend in fine print, and the full disclaimer
 * behind it: a button opens it in a panel over the cover's image, which its
 * close, Escape, the button again or turning the slide shuts, back on the
 * button. On a story card (`compact`) it sets out in full under the legend,
 * and printed it takes the image's place, so the PDF's first page carries it
 * whole. Nothing around the panel may take a transform (`.rise`), or it would
 * position against that instead of the frame.
 */
function CoverDisclaimer({ active, compact }: { active: boolean; compact: boolean }): ReactElement {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(active);
  if (shown !== active) {
    setShown(active);
    if (!active) setOpen(false);
  }
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={styles.disclaimer}>
      <p {...rise(3)} className={`${styles.rise} ${styles.fine} ${styles.legalLegend}`}>
        {LEGAL_LEGEND}
      </p>
      {compact ? null : (
        <button
          ref={buttonRef}
          type="button"
          {...rise(3.5)}
          className={`${styles.rise} ${styles.sourcesToggle} ${styles.disclaimerToggle}`}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => (open ? close() : setOpen(true))}
        >
          Important legal information
        </button>
      )}
      <section
        ref={panelRef}
        id={id}
        className={styles.disclaimerPanel}
        data-open={open || undefined}
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        data-deck-scroll=""
      >
        <header className={styles.disclaimerHead}>
          <h3 id={`${id}-title`} className={styles.label}>
            Important legal information
          </h3>
          {compact ? null : (
            <button type="button" className={styles.disclaimerClose} onClick={close} aria-label="Close">
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" />
              </svg>
            </button>
          )}
        </header>
        <div className={styles.disclaimerFrame}>
          <div id={`${id}-list`} className={styles.disclaimerList}>
            {DISCLAIMER.map((section) => (
              <section key={section.heading} className={styles.disclaimerSection}>
                <h4 className={styles.disclaimerHeading}>{section.heading}</h4>
                <p className={styles.disclaimerBody}>{section.body}</p>
              </section>
            ))}
          </div>
          <OverlayScrollbar targetId={`${id}-list`} showOnHover />
        </div>
      </section>
    </div>
  );
}

function Cover({ slide, active, compact }: { slide: Of<"cover">; active: boolean; compact: boolean }): ReactElement {
  return (
    <div className={styles.cover}>
      <div className={styles.coverText}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the SVG wordmark scales with the slide */}
        <img className={styles.printMark} src="/brand/zode-wordmark-white.svg" alt="ZODE" />
        <div className={styles.coverTitleBlock}>
          <h2 {...rise(1)} className={`${styles.rise} ${styles.display} ${styles.coverTitle}`}>
            {slide.title}
          </h2>
          <p {...rise(2)} className={`${styles.rise} ${styles.coverLede}`}>
            {slide.lede}
          </p>
        </div>
        <CoverDisclaimer active={active} compact={compact} />
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
 * The macro slide, two thirds and one: on the left a quadrant of figure
 * cards, as the home page's features, a drawing (or the token chart) each,
 * captioned in the fewest words; on the right the statement, then the supply
 * chain from capital to offtake as rows, its bottleneck blinking red.
 */
function Stats({ slide, active, compact }: { slide: Of<"stats">; active: boolean; compact: boolean }): ReactElement {
  return (
    <div className={styles.macro}>
      <div className={styles.macroLead}>
        <ul className={styles.macroCards}>
          {[
            ...slide.stats.map((stat) => ({
              key: stat.art,
              value: stat.value,
              label: stat.label,
              art: true,
              figure: <MacroArt id={stat.art} playing={active} />,
            })),
            {
              key: "tokens",
              value: "",
              label: slide.trend,
              art: false,
              figure: <TokenChart active={active} compact={compact} />,
            },
          ].map((card, i) => (
            <li key={card.key} {...rise(2 + i * 0.5)} className={`${styles.rise} ${styles.macroCard}`}>
              <div className={styles.macroFigure} data-art={card.art || undefined}>
                {card.figure}
              </div>
              <p className={styles.macroCaption}>
                {card.value ? <span className={styles.macroValue}>{card.value}</span> : null} {card.label}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.macroChain}>
        <h3 {...rise(2.5)} className={`${styles.rise} ${styles.h3} ${styles.macroStatement}`}>
          {slide.statement}
        </h3>
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
            Forecast US data center capacity, <Cited id="bnef">BNEF base case</Cited>
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
        <ul className={styles.drawnStats}>
          {MARKET_TIGHTNESS.map((item, i) => (
            <li key={item.label} {...rise(4 + i * 0.5)} className={`${styles.rise} ${styles.drawnStat}`}>
              <div className={styles.drawnFigure}>
                <MacroArt id={item.art} playing={active} />
              </div>
              <div className={styles.drawnText}>
                <span className={styles.statValue}>{item.value}</span>
                <span className={styles.statLabel}>{item.label}</span>
                <span className={styles.statSource}>
                  <Cited id={item.cite}>{item.source}</Cited>
                </span>
              </div>
            </li>
          ))}
        </ul>
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

const GATES: readonly GridGate[] = ["paused", "signoff"];

type CitedStat = Stat & { source: string; cite: SourceId };

function policyStats(policy: PolicyMap): CitedStat[] {
  const stats: CitedStat[] = [
    {
      value: String(policy.lawmakerStates),
      label: "States where lawmakers moved to pause new data centers",
      source: "ZODE, from NCSL and state legislatures",
      cite: "ncsl",
    },
  ];
  const { ercotQueueGw: queue, ercotPeakGw: peak } = policy;
  if (queue != null) {
    stats.push({
      value: `${queue} GW`,
      label: peak
        ? `Of large loads waiting on ERCOT, ${(queue / peak).toFixed(1)}× Texas\u2019s record peak`
        : "Of large loads waiting on ERCOT",
      source: "ERCOT",
      cite: "ercot",
    });
  }
  return stats;
}

function States({ active, compact, policy }: { active: boolean; compact: boolean; policy: PolicyMap | null }): ReactElement {
  const states: PolicyState[] = policy ? Object.values(policy.states) : [];
  const count = (test: (state: PolicyState) => boolean) => states.filter(test).length;
  const rows = [
    ...STATUS_ORDER.map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      n: count((state) => state.status === status),
    })),
    { key: "local", label: "Local pauses in effect", n: states.reduce((sum, state) => sum + state.local, 0) },
    ...GATES.map((gate) => ({ key: gate, label: GRID_LABELS[gate], n: count((state) => state.grid?.gate === gate) })),
  ];
  return (
    <div className={styles.chartBody} data-split="map">
      <figure {...rise(2)} className={`${styles.rise} ${styles.figure} ${styles.map}`}>
        <StateTileMap active={active} compact={compact} policy={policy} />
      </figure>
      <aside className={styles.side}>
        {policy ? (
          <>
            <ul {...rise(3)} className={`${styles.rise} ${styles.statusList}`}>
              {rows.map((row) => (
                <li key={row.key} className={styles.status} data-status={row.key}>
                  <span className={styles.swatch} aria-hidden="true">
                    {row.key === "local" ? "12" : null}
                  </span>
                  <span>{row.label}</span>
                  <span className={styles.count}>{row.n}</span>
                </li>
              ))}
            </ul>
            {policyStats(policy).map((item, i) => (
              <div key={item.label} {...rise(4 + i)}>
                <StatBlock stat={item} />
                <span className={styles.statSource}>
                  <Cited id={item.cite}>{item.source}</Cited>
                </span>
              </div>
            ))}
            <p {...rise(6)} className={`${styles.rise} ${styles.fine}`}>
              Both statewide pauses are executive: New York&rsquo;s at 50 MW, Texas&rsquo;s at 75 MW for grid hookups.
              {compact ? null : " Hover a state for its actions."} As of {policy.asOf}.
            </p>
          </>
        ) : (
          <p {...rise(3)} className={`${styles.rise} ${styles.fine}`}>
            The policy tracker can&rsquo;t be read right now, so the map shows the states alone.
          </p>
        )}
      </aside>
    </div>
  );
}

function News({ active }: { active: boolean }): ReactElement {
  return (
    <div className={styles.newsBody}>
      <div className={styles.newsLead}>
        <div {...rise(2)}>
          <StatBlock stat={BLOCKED} highlight size="xl" />
          <span className={styles.statSource}>
            {BLOCKED.detail} · <Cited id="dataCenterWatch">Data Center Watch</Cited>
          </span>
        </div>
        <div {...rise(3)} className={`${styles.rise} ${styles.newsTV}`}>
          <MemeTV playing={active} />
        </div>
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

/**
 * Problem and solution as two columns of cards: down the left each problem
 * as a drawing, its name and one figure; down the right ZODE's answer on the
 * same row, an arrow in the empty column between. The problem that blocks
 * projects outright is drawn in red.
 */
function ProblemSolution({ slide, active }: { slide: Of<"problemSolution">; active: boolean }): ReactElement {
  return (
    <div className={styles.problemSolution}>
      <div {...rise(1.5)} className={`${styles.rise} ${styles.psHead}`}>
        <p className={styles.label}>{slide.columns[0]}</p>
        <span />
        <p className={styles.label}>{slide.columns[1]}</p>
      </div>
      {slide.rows.map(({ art, hard, problem, solution }, i) => (
        <div key={problem.title} className={styles.psRow}>
          <div {...rise(2 + i)} className={`${styles.rise} ${styles.psProblem}`} data-hard={hard || undefined}>
            <div className={styles.psFigure}>
              <MacroArt id={art} hard={hard} light={slide.ground !== "ink"} playing={active} />
            </div>
            <div className={styles.psText}>
              <h3 className={styles.h3}>{problem.title}</h3>
              <p className={styles.psStat}>
                <span className={styles.psStatValue}>{problem.stat.value}</span>
                <span className={styles.statLabel}>
                  <Cited id={problem.stat.cite}>{problem.stat.label}</Cited>
                </span>
              </p>
            </div>
          </div>
          <svg {...rise(2.25 + i)} className={`${styles.rise} ${styles.psArrow}`} viewBox="0 0 40 14" aria-hidden="true">
            <path d="M1 7H39M32 1l7 6-7 6" />
          </svg>
          <div {...rise(2.5 + i)} className={`${styles.rise} ${styles.psSolution}`}>
            <h3 className={styles.h3}>{solution.title}</h3>
            <p className={styles.body}>{solution.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The problems, two halves split by a page-grid rule as the macro slide:
 * building on the left, community on the right. Each half is a grid of
 * figure cards, as the macro slide's quadrant: its biggest problem as one
 * large card across the top, titled, and the rest captioned in a row below.
 */
function Problems({ slide, active }: { slide: Of<"problems">; active: boolean }): ReactElement {
  return (
    <div className={styles.problems}>
      {slide.groups.map((group, g) => (
        <section key={group.label} className={styles.problemGroup}>
          <h3 {...rise(1.5 + g)} className={`${styles.rise} ${styles.label}`}>
            {group.label}
          </h3>
          <ul className={styles.problemCards}>
            <li
              {...rise(2 + g)}
              className={`${styles.rise} ${styles.problemCard}`}
              data-lead=""
              data-hard={group.lead.hard || undefined}
            >
              <div className={styles.problemFigure}>
                <MacroArt id={group.lead.art} hard={group.lead.hard} playing={active} />
              </div>
              <div className={styles.problemLead}>
                <p className={`${styles.h3} ${styles.problemTitle}`}>{group.lead.title}</p>
                <p className={styles.body}>{group.lead.body}</p>
              </div>
            </li>
            {group.rest.map((card, i) => (
              <li
                key={card.title}
                {...rise(2.5 + g + i * 0.4)}
                className={`${styles.rise} ${styles.problemCard}`}
                data-hard={card.hard || undefined}
              >
                <div className={styles.problemFigure}>
                  <MacroArt id={card.art} hard={card.hard} playing={active} />
                </div>
                <p className={styles.problemCaption}>{card.title}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
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
      <NorthAmericaFlags className={styles.solutionFlags} />
    </div>
  );
}

function DesignPrinciples({ active }: { active: boolean }): ReactElement {
  return (
    <div className={styles.designPrinciples}>
      <Principles shown={active} headingLevel={3} className={styles.principles} />
    </div>
  );
}

function Stack({ slide, active, compact }: { slide: Of<"stack">; active: boolean; compact: boolean }): ReactElement {
  return (
    <div className={styles.stack}>
      <div {...rise(2)} className={`${styles.rise} ${styles.lede}`}>
        {slide.lede.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <StackFigure exploded={active} side={!compact} className={styles.stackFigure} />
    </div>
  );
}

/** Numbered cards as the design principles slide's: a drawing over each step, its description always out. */
function Steps({ slide, active }: { slide: Of<"steps">; active: boolean }): ReactElement {
  return (
    <div className={styles.statsBody}>
      <ol className={styles.steps}>
        {slide.steps.map((step, i) => (
          <li key={step.title} {...rise(2 + i)} className={`${styles.rise} ${styles.step}`}>
            <span className={styles.stepIndex}>{String(i + 1).padStart(2, "0")}</span>
            <div className={styles.stepFigure}>
              <MacroArt id={step.art} light={slide.ground !== "ink"} playing={active} />
            </div>
            <h3 className={`${styles.h3} ${styles.stepTitle}`}>{step.title}</h3>
            <p className={styles.body}>{step.body}</p>
          </li>
        ))}
      </ol>
      <p {...rise(6)} className={`${styles.rise} ${styles.statement}`}>
        {slide.statement.map((line) => (
          <span key={line} className={styles.statementLine}>
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * The cluster, two halves split by a page-grid rule as the problems slide:
 * its figures as mini-cards on the left, each an isometric icon in a square
 * cell ruled off from its value and label, the contract's revenue set on
 * ink; on the right the cluster builder's render of it, with the builder and
 * the compute model a new tab away.
 */
function Unit({ slide, active }: { slide: Of<"unit">; active: boolean }): ReactElement {
  return (
    <div className={styles.unit}>
      <ul className={styles.unitCards}>
        {slide.specs.map((spec, i) => {
          const ink = i === slide.highlight;
          return (
            <li
              key={spec.label}
              {...rise(2 + i * 0.4)}
              className={`${styles.rise} ${styles.unitCard}`}
              data-ink={ink || undefined}
            >
              <div className={styles.unitFigure}>
                <UnitIcon id={spec.icon} light={!ink} playing={active} />
              </div>
              <div className={styles.unitText}>
                <span className={styles.unitValue}>{spec.value}</span>
                <span className={styles.statLabel}>{spec.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <figure {...rise(3)} className={`${styles.rise} ${styles.render}`}>
        <div className={styles.renderImage} data-media>
          <Image
            src={slide.image}
            alt="The cluster builder's render of 2,048 B300 GPUs racked in 39 cabinets across four rows"
            fill
            sizes="(max-width: 700px) 100vw, 45vw"
            loading="eager"
          />
        </div>
        <figcaption className={styles.renderCaption}>
          <span className={styles.figLabel}>FIG. 02 — Cluster builder, 256 nodes · 2,048 B300</span>
          <span className={styles.renderLinks}>
            {slide.links.map((link) => (
              <a key={link.href} className={styles.renderLink} href={link.href} target="_blank" rel="noopener">
                {link.label}
                <ArrowOut />
              </a>
            ))}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

/** Square slide units every logo covers, its height found from its aspect, so long and compact marks weigh the same. */
const LOGO_AREA = 7;

function LogoMark({ logo }: { logo: Logo }): ReactElement {
  const height = Math.sqrt(LOGO_AREA / logo.aspect) * (logo.scale ?? 1);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the SVG logos scale with the slide
    <img src={logo.src} alt={logo.name} style={{ "--h": height } as CSSProperties} />
  );
}

/** An arrow up and out of its box, marking a link that opens in a new tab. */
function ArrowOut(): ReactElement {
  return (
    <svg className={styles.renderArrow} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.5 8.5 8.5 1.5M3 1.5h5.5V7" />
    </svg>
  );
}

/** A contract value as clusters: one block per cluster's worth, the last filled to the remainder. */
function ComputeBlocks({ usd, unit }: { usd: number; unit: number }): ReactElement {
  const count = usd / unit;
  const full = Math.floor(count);
  const part = count - full;
  return (
    <div className={styles.blocks}>
      <ul className={styles.blockGrid} aria-hidden="true">
        {Array.from({ length: full }, (_, i) => (
          <li key={i} className={styles.block} />
        ))}
        {part > 0.005 ? (
          <li className={styles.block} data-part style={{ "--fill": part } as CSSProperties} />
        ) : null}
      </ul>
      <span className={styles.blockCount}>{count.toFixed(1)} × 4 MW</span>
    </div>
  );
}

function ContractTerms({ side, delay }: { side: ContractSide; delay: number }): ReactElement {
  return (
    <section className={styles.contractSide}>
      <h3 {...rise(delay)} className={`${styles.rise} ${styles.figLabel} ${styles.contractTitle}`}>
        {side.title}
      </h3>
      <dl className={styles.details}>
        {side.rows.map((row, i) => (
          <div key={row.label} {...rise(delay + 0.5 + i * 0.4)} className={`${styles.rise} ${styles.detail}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The signed total in a large card and the LOIs in a mini-card under it,
 * each drawn as blocks of one 4 MW cluster's contract value so the two read
 * against each other; the demand side's terms and the supply side's costs
 * on the right; the customers by stage across the foot of the body.
 */
function Traction({ slide }: { slide: Of<"traction"> }): ReactElement {
  return (
    <div className={styles.traction}>
      <div className={styles.split}>
        <div className={styles.contractCards}>
          <div {...rise(2)} className={`${styles.rise} ${styles.contractCard}`}>
            <StatBlock stat={slide.contracted} highlight size="xl" />
            <ComputeBlocks usd={slide.contracted.usd} unit={slide.block.usd} />
          </div>
          <div {...rise(2.5)} className={`${styles.rise} ${styles.contractCard}`} data-size="mini">
            <StatBlock stat={slide.loi} />
            <ComputeBlocks usd={slide.loi.usd} unit={slide.block.usd} />
          </div>
          <p {...rise(3)} className={`${styles.rise} ${styles.fine}`}>
            {slide.block.note}
          </p>
        </div>
        <div className={styles.contractSides}>
          <ContractTerms side={slide.demand} delay={3} />
          <ContractTerms side={slide.supply} delay={5.5} />
        </div>
      </div>
      <div className={styles.customers}>
        {slide.customers.map((group, i) => (
          <div key={group.label} {...rise(7 + i * 0.5)} className={`${styles.rise} ${styles.customerGroup}`}>
            <span className={styles.figLabel}>{group.label}</span>
            <ul className={styles.logos}>
              {group.logos.map((logo) => (
                <li key={logo.name}>
                  <LogoMark logo={logo} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The sites as mini-cards down the left, as the unit slide's: a line map of
 * each city filling a square cell, ruled off from its name, path, status and
 * IT MW, the total under them. On the right the capacity contracted beyond
 * them, then the plan by year, its bars on a log scale so each tenfold year
 * adds one step; the last year is set on ink.
 */
/** A dollar figure or range, e.g. "$18.8M" or "$50–75M"; split out with its capture so it alternates with the text. */
const FIGURE = /(\$[\d.]+(?:–[\d.]+)?[MB])/;

/** The cell in user units; the ripple is a single windowed sine cycle `RIPPLE` wide, parked just left of it. */
const WAVE_SPAN = 300;
const WAVE_HEIGHT = 12;
const RIPPLE = 40;
const RIPPLE_AMPLITUDE = 1.5;
/** A flat line well past both ends, with the ripple in [-RIPPLE, 0], so sliding it `WAVE_SPAN + RIPPLE` right carries it across and off. */
const WAVE_PATH = [
  `M${-RIPPLE - 20} ${WAVE_HEIGHT / 2}`,
  ...Array.from({ length: RIPPLE * 2 + 1 }, (_, k) => {
    const t = k / (RIPPLE * 2);
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
    const y = WAVE_HEIGHT / 2 + RIPPLE_AMPLITUDE * window * Math.sin(2 * Math.PI * t);
    return `L${(-RIPPLE + t * RIPPLE).toFixed(1)} ${y.toFixed(2)}`;
  }),
  `L${WAVE_SPAN + RIPPLE + 20} ${WAVE_HEIGHT / 2}`,
].join(" ");

/** How long a ripple takes to cross, and the bounds of the random rest before the next. */
const RIPPLE_MS = 1600;
const REST_MS = [1800, 6500] as const;

/**
 * The last year's bar: flat as the others, with a ripple that runs along it
 * at random intervals while the slide is open. Lengths on an SVG element
 * resolve in user units, so the slide is the cell's width plus the ripple's.
 */
function PlanWave({ active }: { active: boolean }): ReactElement {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const path = ref.current;
    if (!active || !path || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let animation: Animation | undefined;
    const rest = () => REST_MS[0] + Math.random() * (REST_MS[1] - REST_MS[0]);
    const ripple = () => {
      animation = path.animate(
        [{ transform: "translateX(0)" }, { transform: `translateX(${WAVE_SPAN + RIPPLE}px)` }],
        { duration: RIPPLE_MS, easing: "linear" },
      );
      animation.onfinish = () => {
        timer = window.setTimeout(ripple, rest());
      };
    };
    timer = window.setTimeout(ripple, 800 + Math.random() * 1200);
    return () => {
      window.clearTimeout(timer);
      animation?.cancel();
    };
  }, [active]);
  return (
    <svg className={styles.planWave} viewBox={`0 0 ${WAVE_SPAN} ${WAVE_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      <path ref={ref} className={styles.planWaveLine} d={WAVE_PATH} />
    </svg>
  );
}

function Pipeline({ slide, active }: { slide: Of<"pipeline">; active: boolean }): ReactElement {
  const steps = slide.plan.length;
  return (
    <div className={styles.split} data-split="sites">
      <div className={styles.sites}>
        <ul className={styles.siteCards}>
          {slide.sites.map((site, i) => (
            <li key={site.site} {...rise(2 + i * 0.4)} className={`${styles.rise} ${styles.siteCard}`}>
              <div className={styles.siteMap}>
                <SiteMap id={site.map} />
              </div>
              <div className={styles.siteText}>
                <span className={styles.siteName}>{site.site}</span>
                <span className={styles.statLabel}>
                  {site.path} · {site.status}
                </span>
              </div>
              <span className={styles.siteMw}>
                {site.mw}
                <span className={styles.siteUnit}> MW</span>
              </span>
            </li>
          ))}
        </ul>
        <p {...rise(4.5)} className={`${styles.rise} ${styles.siteFoot}`}>
          <span className={styles.siteTotal}>
            Total <span>{slide.total} IT MW</span>
          </span>
          <span className={styles.fine}>Maps © OpenStreetMap contributors</span>
        </p>
      </div>
      <div className={styles.pipelineSide}>
        <section {...rise(3)} className={styles.rise}>
          <h3 className={styles.label}>Contracted capacity</h3>
          <div className={styles.capacity}>
            {slide.capacity.map((stat) => (
              <StatBlock key={stat.label} stat={stat} />
            ))}
          </div>
        </section>
        <section className={styles.planSection}>
          <h3 {...rise(4)} className={`${styles.rise} ${styles.label}`}>
            Plan
          </h3>
          <ol className={styles.plan}>
            {slide.plan.map((row, i) => (
              <li
                key={row.year}
                {...rise(4.5 + i * 0.4)}
                className={`${styles.rise} ${styles.planRow}`}
                data-ink={i === steps - 1 || undefined}
              >
                <span className={styles.planYear}>{row.year}</span>
                {i === steps - 1 ? (
                  <PlanWave active={active} />
                ) : (
                  <span className={styles.planBar} style={{ "--share": (i + 1) / steps } as CSSProperties} />
                )}
                <span className={styles.planValue}>{row.value}</span>
              </li>
            ))}
          </ol>
        </section>
        <div {...rise(4.5 + steps * 0.4)} className={`${styles.rise} ${styles.planNote}`}>
          <p className={styles.planStatement}>
            {slide.planNote.map((line) => (
              <span key={line} className={styles.statementLine}>
                {line.split(FIGURE).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
              </span>
            ))}
          </p>
          <p className={styles.fine}>{slide.planBasis}</p>
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

/**
 * The deals as one panel of cards across the top, each headed by its icon in
 * a square cell ruled off from its title, as the unit slide's mini-cards, then
 * what it funds and its capital stack, equity over debt, as blocks at its foot
 * so the stacks stand on one line. Under them the example: one stacked bar, each
 * layer as wide as its share of the total, shaded by its deal and bracketed
 * under the deal's name, the deals in the cards' order.
 */
function Finance({ slide, active }: { slide: Of<"finance">; active: boolean }): ReactElement {
  const { example } = slide;
  const groups = slide.deals
    .map((deal) => {
      const layers = example.layers.filter((layer) => layer.deal === deal.id);
      return { deal, layers, usd: layers.reduce((sum, layer) => sum + layer.usd, 0) };
    })
    .filter((group) => group.layers.length);
  return (
    <div className={styles.finance}>
      <ul className={styles.deals}>
        {slide.deals.map((deal, i) => (
          <li key={deal.id} {...rise(2 + i * 0.4)} className={`${styles.rise} ${styles.deal}`}>
            <div className={styles.dealHead}>
              <div className={styles.dealFigure}>
                <UnitIcon id={deal.icon} light playing={active} />
              </div>
              <div className={styles.dealHeading}>
                <h3 className={styles.dealTitle}>{deal.title}</h3>
                <span className={styles.statLabel}>{deal.purpose}</span>
              </div>
            </div>
            <p className={`${styles.body} ${styles.dealBody}`}>{deal.body}</p>
            <ol className={styles.dealStack} aria-label={`${deal.title} capital stack`}>
              {deal.layers.map((layer) => (
                <li key={layer.label} className={styles.dealLayer} data-kind={layer.kind}>
                  <span className={styles.dealLayerLabel}>{layer.label}</span>
                  {layer.terms ? (
                    <span className={styles.dealLayerTerms}>
                      {layer.terms.map((term) => (
                        <span key={term}>{term}</span>
                      ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
      <section {...rise(3.5)} className={`${styles.rise} ${styles.stackExample}`}>
        <h3 className={styles.label}>{example.title}</h3>
        <div className={styles.stackRow}>
          <ol className={styles.stackBar}>
            {groups.map(({ deal, layers, usd }) => (
              <li key={deal.id} className={styles.stackGroup} style={{ "--usd": usd } as CSSProperties}>
                <span className={styles.stackGroupName}>{deal.title}</span>
                <ol className={styles.stackGroupLayers}>
                  {layers.map((layer) => (
                    <li
                      key={layer.label}
                      className={styles.stackSegment}
                      data-deal={layer.deal}
                      style={{ "--usd": layer.usd } as CSSProperties}
                    >
                      <span className={styles.stackTag}>{layer.kind === "debt" ? "Debt" : "Equity"}</span>
                      <span className={styles.stackValue}>{layer.value}</span>
                      <span className={styles.stackLabel}>{layer.label}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <p className={styles.stackTotal}>
            <span className={styles.stackValue}>{example.total}</span>
            <span className={styles.label}>Total</span>
          </p>
        </div>
        <p className={styles.fine}>{example.note}</p>
      </section>
    </div>
  );
}

/** A raise card's head, as the finance slide's deal cards: its icon in a square cell, ruled off from the title. */
function RaiseHead({
  icon,
  title,
  purpose,
  playing,
}: {
  icon: UnitIconId;
  title: string;
  purpose: string;
  playing: boolean;
}): ReactElement {
  return (
    <div className={styles.dealHead}>
      <div className={styles.dealFigure}>
        <UnitIcon id={icon} light playing={playing} />
      </div>
      <div className={styles.dealHeading}>
        <h3 className={styles.dealTitle}>{title}</h3>
        <span className={styles.statLabel}>{purpose}</span>
      </div>
    </div>
  );
}

/**
 * The issuer's raise as three cards in a row, as the finance slide's deals:
 * the cluster's targets, its capital stack as the deals' blocks, and its
 * revenue over the contract and by year. Under them the first close on ink,
 * as the unit slide's highlighted card, beside the basis and legend.
 */
function Raise({ slide, playing }: { slide: Of<"raise">; playing: boolean }): ReactElement {
  const { cluster, capital, revenue } = slide;
  return (
    <div className={styles.raise}>
      <ul className={`${styles.deals} ${styles.raiseCards}`}>
        <li {...rise(2)} className={`${styles.rise} ${styles.deal} ${styles.raiseCard}`}>
          <RaiseHead icon="node" title="The cluster" purpose={cluster.purpose} playing={playing} />
          <dl className={styles.raiseRows}>
            {cluster.rows.map((row) => (
              <div key={row.label} className={styles.raiseRow}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </li>
        <li {...rise(2.4)} className={`${styles.rise} ${styles.deal} ${styles.raiseCard}`}>
          <RaiseHead icon="prepay" title="The capital" purpose={capital.purpose} playing={playing} />
          <ol className={`${styles.dealStack} ${styles.raiseStack}`} aria-label="Capital stack">
            {capital.layers.map((layer) => (
              <li key={layer.label} className={`${styles.dealLayer} ${styles.raiseLayer}`} data-kind={layer.kind}>
                <span className={styles.raiseLayerText}>
                  <span className={styles.dealLayerLabel}>{layer.label}</span>
                  <span className={styles.dealLayerTerms}>
                    {layer.terms.map((term) => (
                      <span key={term}>{term}</span>
                    ))}
                  </span>
                </span>
                <span className={styles.raiseValue}>{layer.value}</span>
              </li>
            ))}
          </ol>
        </li>
        <li {...rise(2.8)} className={`${styles.rise} ${styles.deal} ${styles.raiseCard}`}>
          <RaiseHead icon="revenue" title="The revenue" purpose={revenue.purpose} playing={playing} />
          <table className={styles.raiseTable}>
            <thead>
              <tr>
                <td />
                {revenue.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revenue.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.contract}</td>
                  <td>{row.annual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
      </ul>
      <section {...rise(3.5)} className={`${styles.rise} ${styles.raiseFoot}`}>
        <div className={styles.raiseClose}>
          <span className={styles.raiseCloseValue}>{slide.firstClose.value}</span>
          <span className={styles.statLabel}>{slide.firstClose.label}</span>
        </div>
        <div className={styles.raiseNotes}>
          <p className={styles.fine}>{slide.note}</p>
          <p className={styles.fine}>{RAISE_NOTE}</p>
        </div>
      </section>
    </div>
  );
}

function LinkedInMark(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 4.89v6.25ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

/**
 * The founder on the left, the ventures ruled under the name, each
 * company's years tagged on the right; on the right the
 * team, alliances and advisors as rows of logos by area.
 */
function Team({ slide }: { slide: Of<"team"> }): ReactElement {
  const { founder, network } = slide;
  return (
    <div className={styles.split} data-split="team">
      <div className={styles.founder}>
        <div {...rise(2)} className={styles.rise}>
          <p className={styles.label}>{founder.role}</p>
          <h3 className={`${styles.h3} ${styles.person}`}>{founder.name}</h3>
          <a
            className={styles.linkedin}
            href={founder.linkedin}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${founder.name} on LinkedIn`}
          >
            <LinkedInMark />
          </a>
        </div>
        <ul className={styles.ventures}>
          {founder.ventures.map((venture, i) => (
            <li key={venture.company} {...rise(3 + i * 0.4)} className={`${styles.rise} ${styles.venture}`}>
              <div className={styles.ventureHead}>
                <a className={styles.ventureName} href={venture.href} target="_blank" rel="noreferrer noopener">
                  {venture.company}
                </a>
                <span className={styles.years}>{venture.years}</span>
              </div>
              <p className={styles.ventureRole}>{venture.role}</p>
              <p className={styles.ventureText}>{venture.description}</p>
              <p className={`${styles.ventureText} ${styles.ventureOutcome}`}>{venture.outcome}</p>
            </li>
          ))}
        </ul>
      </div>
      <section className={styles.network}>
        <h3 {...rise(4)} className={`${styles.rise} ${styles.figLabel}`}>
          {network.title}
        </h3>
        {network.areas.map((area, i) => (
          <div key={area.label} {...rise(4.5 + i * 0.5)} className={`${styles.rise} ${styles.networkArea}`}>
            <span className={styles.label}>{area.label}</span>
            <ul className={styles.logos}>
              {area.logos.map((logo) => (
                <li key={logo.name}>
                  <LogoMark logo={logo} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
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
  {
    title: "Policy",
    ids: ["ncsl", "newYork", "texas", "oregon", "ercot", "eei", "moratoriumNation", "dataCenterWatch", "heatmap", "transformers"],
  },
];

/** Set under the news, where the third column has room. */
const VALUATION_SOURCES: readonly SourceId[] = ["evPerMw"];

function Citations({ ids }: { ids: readonly SourceId[] }): ReactElement {
  return (
    <ol className={styles.citations}>
      {ids.map((id) => {
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
  );
}

function Sources(): ReactElement {
  return (
    <div className={styles.sourcesBody}>
      {SOURCE_GROUPS.map((group, g) => (
        <div key={group.title} {...rise(2 + g)} className={styles.rise}>
          <h3 className={styles.label}>{group.title}</h3>
          <Citations ids={group.ids} />
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
        <h3 className={`${styles.label} ${styles.citationsNext}`}>Valuation</h3>
        <Citations ids={VALUATION_SOURCES} />
        <p className={styles.fine}>
          As of {AS_OF}. The dashed grid line on the demand chart is ZODE&rsquo;s illustration, not a third-party forecast.
          Pipeline, contract and financing figures are ZODE&rsquo;s own and preliminary where noted.
        </p>
      </div>
    </div>
  );
}

function Body({
  slide,
  active,
  compact,
  policy,
}: {
  slide: Slide;
  active: boolean;
  compact: boolean;
  policy: PolicyMap | null;
}): ReactNode {
  switch (slide.kind) {
    case "cover":
      return <Cover slide={slide} active={active} compact={compact} />;
    case "stats":
      return <Stats slide={slide} active={active} compact={compact} />;
    case "demand":
      return <Demand active={active} compact={compact} />;
    case "shortfall":
      return <Shortfall active={active} compact={compact} />;
    case "states":
      return <States active={active} compact={compact} policy={policy} />;
    case "news":
      return <News active={active} />;
    case "problemSolution":
      return <ProblemSolution slide={slide} active={active} />;
    case "problems":
      return <Problems slide={slide} active={active} />;
    case "solution":
      return <Solution slide={slide} active={active} />;
    case "principles":
      return <DesignPrinciples active={active} />;
    case "stack":
      return <Stack slide={slide} active={active} compact={compact} />;
    case "steps":
      return <Steps slide={slide} active={active} />;
    case "unit":
      return <Unit slide={slide} active={active} />;
    case "traction":
      return <Traction slide={slide} />;
    case "pipeline":
      return <Pipeline slide={slide} active={active} />;
    case "comparison":
      return <Comparison slide={slide} />;
    case "finance":
      return <Finance slide={slide} active={active} />;
    case "raise":
      return <Raise slide={slide} playing={playing} />;
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
 * and a foot band with the section name, sources and page number.
 * `grid` draws the rails and rules on the slide itself; the stage turns it
 * off and draws one shared grid over every slide instead, finding the bands
 * by `data-band`. `active` plays its entrance; `branded` adds the wordmark to
 * its foot for print, where the site header isn't on the page. `compact`
 * reflows it as a phone's story card: one column at the site's mobile type
 * sizes, scrolling where it runs long. `policy` is the policy tracker's map
 * for the states slide.
 */
export function SlideView({
  slide,
  index,
  total,
  active,
  branded = false,
  grid = true,
  compact = false,
  policy,
}: {
  slide: Slide;
  index: number;
  total: number;
  active: boolean;
  branded?: boolean;
  grid?: boolean;
  compact?: boolean;
  policy: PolicyMap | null;
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
          <Body slide={slide} active={active} compact={compact} policy={policy} />
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

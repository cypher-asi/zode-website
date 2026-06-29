"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Anthropic,
  ByteDance,
  DeepSeek,
  Gemini,
  Minimax,
  Moonshot,
  OpenAI,
  Qwen,
  Tripo,
  ZAI,
} from "@lobehub/icons";
import type { SectionContent } from "@/content/sections";
import { SlideLayout } from "@/components/SlideLayout";
import { useInView } from "@/lib/useInView";
import styles from "./EcosystemScene.module.css";

/** Provider brand-mark size in the demand rail. */
const LOGO_SIZE = 27;

/**
 * Provider key (from section content) -> brand mark. Marks render as the
 * mono variant so they inherit `currentColor` and read in both themes.
 */
const PROVIDER_LOGOS: Record<string, ReactNode> = {
  Anthropic: <Anthropic size={LOGO_SIZE} />,
  OpenAI: <OpenAI size={LOGO_SIZE} />,
  "DeepSeek AI": <DeepSeek size={LOGO_SIZE} />,
  "Moonshot AI": <Moonshot size={LOGO_SIZE} />,
  MiniMax: <Minimax size={LOGO_SIZE} />,
  "Z.ai": <ZAI size={LOGO_SIZE} />,
  "Alibaba Cloud": <Qwen size={LOGO_SIZE} />,
  Google: <Gemini size={LOGO_SIZE} />,
  "Tripo AI": <Tripo size={LOGO_SIZE} />,
  ByteDance: <ByteDance size={LOGO_SIZE} />,
};

interface Point {
  readonly x: number;
  readonly y: number;
}

/** How long one light dot takes to travel a line, icon to port. */
const PULSE_DUR_S = 2.6;
/** Per-line offset so the dots don't travel in lockstep. */
const LINE_STAGGER_S = 0.5;
/** Head + trailing ghosts that form each line's travelling comet. */
const PULSE_GHOSTS = 4;
/** Lag between successive ghosts in the trail, in seconds. */
const GHOST_GAP_S = 0.18;

function readNozzlePoints(stage: HTMLElement, count: number): Point[] {
  const stageRect = stage.getBoundingClientRect();
  const points = new Array<Point | undefined>(count);
  stage.querySelectorAll<HTMLElement>("[data-rail-nozzle]").forEach((el) => {
    const index = Number(el.dataset.railNozzle);
    if (Number.isNaN(index)) {
      return;
    }
    const rect = el.getBoundingClientRect();
    points[index] = {
      x: rect.left + rect.width / 2 - stageRect.left,
      y: rect.top + rect.height / 2 - stageRect.top,
    };
  });
  return points.filter((p): p is Point => p !== undefined);
}

function readPortPoint(stage: HTMLElement): Point | null {
  const el = stage.querySelector<HTMLElement>("[data-device-port]");
  if (!el) {
    return null;
  }
  const stageRect = stage.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - stageRect.left,
    y: rect.top + rect.height / 2 - stageRect.top,
  };
}

function curve(from: Point, to: Point): string {
  const dx = (to.x - from.x) * 0.5;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${(from.x + dx).toFixed(1)} ${from.y.toFixed(1)}, ${(to.x - dx).toFixed(1)} ${to.y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

/**
 * SVG overlay that routes every provider icon into a single converging port on
 * the left edge of the central constellation. Each line carries a continuous
 * light pulse so it reads as compute flowing into the network; when a provider
 * is active its line surges gold. Endpoints are measured from the live DOM
 * (icons tagged `data-rail-nozzle`, the circle a single `data-device-port`),
 * so the lines stay glued across resizes without hard-coded geometry.
 */
function ConnectionField({
  stageRef,
  count,
  activeIndex,
}: {
  readonly stageRef: RefObject<HTMLDivElement | null>;
  readonly count: number;
  readonly activeIndex: number | null;
}): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [nozzles, setNozzles] = useState<Point[]>([]);
  const [port, setPort] = useState<Point | null>(null);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    setNozzles(readNozzlePoints(stage, count));
    setPort(readPortPoint(stage));
  }, [stageRef, count]);

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [measure]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [stageRef, measure]);

  if (nozzles.length === 0 || port === null || size.width === 0) {
    return (
      <svg className={styles.connectionField} aria-hidden="true" focusable="false" />
    );
  }

  const lines = nozzles.map((from, i) => ({
    key: i,
    d: curve(from, port),
    active: activeIndex === i,
  }));

  return (
    <svg
      className={styles.connectionField}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {lines.map((line) => {
        const pathId = `gridFlowPath-${line.key}`;
        return (
          <g
            key={line.key}
            className={styles.flowLine}
            data-active={line.active ? "true" : undefined}
          >
            <path id={pathId} className={styles.flowBase} d={line.d} />
            {Array.from({ length: PULSE_GHOSTS }, (_, g) => (
              <circle
                key={g}
                className={styles.flowDot}
                r={2.6 - g * 0.45}
                style={{ opacity: 1 - g * (0.7 / PULSE_GHOSTS) }}
              >
                <animateMotion
                  dur={`${PULSE_DUR_S}s`}
                  begin={`${-line.key * LINE_STAGGER_S + g * GHOST_GAP_S}s`}
                  repeatCount="indefinite"
                  calcMode="linear"
                >
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Main constellation nodes, in viewBox percent coords (0..100). Positions are
 * kept inside a ~42-unit radius of centre so they sit within the circular disk.
 */
const STARS: readonly Point[] = [
  { x: 50, y: 18 },
  { x: 30, y: 30 },
  { x: 70, y: 28 },
  { x: 22, y: 50 },
  { x: 50, y: 44 },
  { x: 78, y: 50 },
  { x: 36, y: 62 },
  { x: 64, y: 60 },
  { x: 50, y: 74 },
  { x: 28, y: 78 },
  { x: 72, y: 78 },
  { x: 50, y: 88 },
];

/**
 * Faint background star dots. Hardcoded (not random) so the server and client
 * first paint agree — no hydration drift.
 */
const DOTS: readonly (Point & { r: number })[] = [
  { x: 18, y: 22, r: 0.7 },
  { x: 40, y: 16, r: 0.5 },
  { x: 62, y: 14, r: 0.8 },
  { x: 82, y: 24, r: 0.6 },
  { x: 14, y: 38, r: 0.5 },
  { x: 33, y: 40, r: 0.6 },
  { x: 58, y: 36, r: 0.5 },
  { x: 88, y: 40, r: 0.7 },
  { x: 24, y: 60, r: 0.6 },
  { x: 44, y: 54, r: 0.5 },
  { x: 60, y: 52, r: 0.7 },
  { x: 84, y: 62, r: 0.5 },
  { x: 16, y: 70, r: 0.6 },
  { x: 40, y: 70, r: 0.5 },
  { x: 56, y: 70, r: 0.6 },
  { x: 80, y: 72, r: 0.7 },
  { x: 30, y: 88, r: 0.5 },
  { x: 64, y: 86, r: 0.6 },
  { x: 46, y: 30, r: 0.5 },
  { x: 70, y: 44, r: 0.6 },
  { x: 26, y: 44, r: 0.5 },
  { x: 50, y: 60, r: 0.6 },
  { x: 36, y: 24, r: 0.5 },
  { x: 74, y: 64, r: 0.5 },
  { x: 20, y: 82, r: 0.6 },
  { x: 86, y: 52, r: 0.5 },
  { x: 12, y: 54, r: 0.5 },
  { x: 52, y: 80, r: 0.6 },
  { x: 66, y: 74, r: 0.5 },
  { x: 42, y: 84, r: 0.5 },
];

/**
 * Zodiac wirings — each is an ordered list of {@link STARS} indices joined into
 * a polyline. On every constellation tick the active pattern advances, so the
 * lines reconfigure into a different shape, like a new zodiac sign.
 */
const ZODIAC_PATTERNS: readonly (readonly number[])[] = [
  [0, 2, 5, 7, 8],
  [1, 4, 5, 10, 8, 6, 3],
  [0, 1, 3, 6, 9, 11],
  [2, 5, 7, 4, 1, 0],
  [3, 4, 7, 10, 11, 8, 6],
  [0, 4, 8, 7, 5, 2],
];

/** How long one zodiac stays lit before the wiring reconfigures. */
const CONSTELLATION_TICK_MS = 2000;

/**
 * Pure CSS/SVG star map that fills the central disk. A field of faint dots sits
 * behind a set of main nodes; the `patternIndex` selects one zodiac wiring whose
 * edges draw in the green accent and whose nodes glow. The fast transaction tick
 * flashes whichever node (`activeStar`) a transaction is currently settling on.
 */
function Constellation({
  patternIndex,
  activeStar,
}: {
  readonly patternIndex: number;
  readonly activeStar: number | null;
}): ReactElement {
  const pattern = ZODIAC_PATTERNS[patternIndex % ZODIAC_PATTERNS.length];
  const activeSet = new Set(pattern);
  const points = pattern
    .map((i) => `${STARS[i].x},${STARS[i].y}`)
    .join(" ");

  return (
    <svg
      className={styles.starMap}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {DOTS.map((dot, i) => (
        <circle
          key={`dot-${i}`}
          className={styles.dot}
          cx={dot.x}
          cy={dot.y}
          r={dot.r * 0.62}
        />
      ))}

      {/* Re-mount on pattern change so the draw-in animation replays. */}
      <polyline
        key={patternIndex}
        className={styles.edge}
        points={points}
      />

      {STARS.map((star, i) => (
        <circle
          key={`star-${i}`}
          className={styles.starNode}
          cx={star.x}
          cy={star.y}
          r={1.1}
          data-on={activeSet.has(i) ? "true" : undefined}
          data-flash={activeStar === i ? "true" : undefined}
        />
      ))}
    </svg>
  );
}

interface Transaction {
  readonly id: string;
  readonly address: string;
  readonly company: string;
  readonly units: number;
  readonly zode: string;
  readonly status: "finalizing" | "finalized";
}

const HEX = "0123456789abcdef";

/** Builds a truncated, explorer-style address (e.g. "227622a...4ab0037"). */
function randomAddress(): string {
  let body = "";
  for (let i = 0; i < 40; i += 1) {
    body += HEX[Math.floor(Math.random() * HEX.length)];
  }
  return `${body.slice(0, 7)}...${body.slice(-7)}`;
}

const DEFAULT_COMPANIES = [
  { name: "Anthropic", provider: "Anthropic" },
  { name: "OpenAI", provider: "OpenAI" },
  { name: "Gemini", provider: "Google" },
  { name: "DeepSeek", provider: "DeepSeek AI" },
  { name: "Kimi", provider: "Moonshot AI" },
  { name: "MiniMax", provider: "MiniMax" },
  { name: "GLM", provider: "Z.ai" },
  { name: "Qwen", provider: "Alibaba Cloud" },
  { name: "Doubao", provider: "ByteDance" },
  { name: "Tripo", provider: "Tripo AI" },
] as const;

const DEFAULT_ZODES = [
  "ZODE-01",
  "ZODE-02",
  "ZODE-03",
  "ZODE-04",
  "ZODE-05",
  "ZODE-06",
] as const;

const FEED_LIMIT = 6;
/** Transactions stream in quickly... */
const TX_TICK_MS = 650;
const TX_FINALIZE_MS = 420;
/** ...while compute demand on the left shifts at a slower, steadier pace. */
const DEMAND_TICK_MS = 2200;

/** Fixed seed so the first paint matches the server render (no hydration drift). */
const SEED_FEED: readonly Transaction[] = [
  {
    id: "seed-1",
    address: "8f1a3c2...d04e7b1",
    company: "Helix AI",
    units: 248,
    zode: "ZODE-02",
    status: "finalized",
  },
  {
    id: "seed-2",
    address: "3c40a91...e2f5c80",
    company: "Northwind",
    units: 96,
    zode: "ZODE-04",
    status: "finalized",
  },
  {
    id: "seed-3",
    address: "227622a...4ab0037",
    company: "Vector Labs",
    units: 512,
    zode: "ZODE-03",
    status: "finalized",
  },
  {
    id: "seed-4",
    address: "b9044e1...7c1da26",
    company: "Cortex",
    units: 128,
    zode: "ZODE-06",
    status: "finalized",
  },
  {
    id: "seed-5",
    address: "5e7720c...a31f9b4",
    company: "Meridian",
    units: 384,
    zode: "ZODE-01",
    status: "finalized",
  },
  {
    id: "seed-6",
    address: "1d3f8a0...6042ec5",
    company: "Orbital",
    units: 64,
    zode: "ZODE-05",
    status: "finalized",
  },
];

export function EcosystemScene({
  section,
}: {
  section: SectionContent;
}): ReactElement {
  const companies =
    section.companies && section.companies.length > 0
      ? section.companies
      : DEFAULT_COMPANIES;
  const zodes =
    section.zodes && section.zodes.length > 0 ? section.zodes : DEFAULT_ZODES;

  const [feed, setFeed] = useState<readonly Transaction[]>(SEED_FEED);
  const [activeCompany, setActiveCompany] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [patternIndex, setPatternIndex] = useState(0);
  const counter = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  // The deck mounts every slide at once; hold the animation timers until the
  // scene is actually near the viewport so they don't churn on initial load.
  const inView = useInView(gridRef);

  // Fast loop: stream transactions in, lighting the node each one settles on.
  useEffect(() => {
    if (!inView) return;
    let finalizeTimer: ReturnType<typeof setTimeout> | undefined;

    const emit = () => {
      const companyIndex = Math.floor(Math.random() * companies.length);
      const zodeIndex = Math.floor(Math.random() * zodes.length);
      counter.current += 1;
      const units = [64, 96, 128, 256, 384, 512][
        Math.floor(Math.random() * 6)
      ];

      const tx: Transaction = {
        id: `tx-${counter.current}`,
        address: randomAddress(),
        company: companies[companyIndex].name,
        units,
        zode: zodes[zodeIndex],
        status: "finalizing",
      };

      setActiveNode(zodeIndex);
      setFeed((prev) => [tx, ...prev].slice(0, FEED_LIMIT));

      finalizeTimer = setTimeout(() => {
        setFeed((prev) =>
          prev.map((row) =>
            row.id === tx.id ? { ...row, status: "finalized" } : row,
          ),
        );
        setActiveNode(null);
      }, TX_FINALIZE_MS);
    };

    emit();
    const interval = setInterval(emit, TX_TICK_MS);
    return () => {
      clearInterval(interval);
      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
      }
    };
  }, [companies, zodes, inView]);

  // Slow loop: shift which company is actively drawing compute.
  useEffect(() => {
    if (!inView) return;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    const pulse = () => {
      const companyIndex = Math.floor(Math.random() * companies.length);
      setActiveCompany(companyIndex);
      clearTimer = setTimeout(
        () => setActiveCompany(null),
        DEMAND_TICK_MS * 0.6,
      );
    };

    pulse();
    const interval = setInterval(pulse, DEMAND_TICK_MS);
    return () => {
      clearInterval(interval);
      if (clearTimer) {
        clearTimeout(clearTimer);
      }
    };
  }, [companies, inView]);

  // Constellation loop: reconfigure the zodiac wiring on a steady tick.
  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setPatternIndex((prev) => (prev + 1) % ZODIAC_PATTERNS.length);
    }, CONSTELLATION_TICK_MS);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <SlideLayout
      id={section.id}
      ariaLabel={section.label}
      className={styles.slide}
      top={
        <header className={styles.header}>
          <p className={styles.kicker}>{section.label}</p>
          <h2 className={styles.title}>{section.title}</h2>
          {section.lede && <p className={styles.lede}>{section.lede}</p>}
        </header>
      }
      middle={
        <div className={styles.grid} ref={gridRef}>
        <ConnectionField
          stageRef={gridRef}
          count={companies.length}
          activeIndex={activeCompany}
        />

        {/* Left: providers that need compute */}
        <section className={styles.panel} aria-label="Demand">
          <p className={styles.panelLabel}>Demand</p>
          <ul className={styles.companyList}>
            {companies.map((company, index) => (
              <li
                key={company.name}
                className={styles.company}
                data-active={activeCompany === index ? "true" : undefined}
              >
                <span
                  className={styles.companyIcon}
                  data-rail-nozzle={index}
                  role="img"
                  aria-label={company.name}
                  title={company.name}
                >
                  {PROVIDER_LOGOS[company.provider] ?? null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Middle: the network of ZODEs */}
        <section className={styles.network} aria-label="ZODE network">
          <div
            className={styles.constellation}
            data-active={activeNode !== null ? "true" : undefined}
          >
            <Constellation
              patternIndex={patternIndex}
              activeStar={activeNode === null ? null : activeNode % STARS.length}
            />
            <span
              className={styles.port}
              data-device-port
              data-active={activeCompany !== null ? "true" : undefined}
              aria-hidden="true"
            />
          </div>
        </section>

        {/* Right: live, finalizing transactions */}
        <section className={styles.panel} aria-label="Live transactions">
          <p className={styles.panelLabel}>Live transactions</p>
          <ul className={styles.feed}>
            {feed.map((tx) => (
              <li key={tx.id} className={styles.tx}>
                <div className={styles.txTop}>
                  <span className={styles.txRoute}>
                    <span className={styles.txCompany}>{tx.company}</span>
                    <span className={styles.txArrow} aria-hidden="true">
                      →
                    </span>
                    <span className={styles.txNode}>{tx.zode}</span>
                  </span>
                  <span className={styles.txStatus} data-status={tx.status}>
                    {tx.status === "finalizing" ? "finalizing" : "finalized"}
                  </span>
                </div>
                <div className={styles.txMeta}>
                  <span className={styles.txAddress}>{tx.address}</span>
                  <span className={styles.txUnits}>{tx.units} NRG</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
        </div>
      }
    />
  );
}

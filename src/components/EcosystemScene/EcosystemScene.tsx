"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import Image from "next/image";
import type { SectionContent } from "@/content/sections";
import styles from "./EcosystemScene.module.css";

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
  { name: "Vector Labs", monogram: "V" },
  { name: "Helix AI", monogram: "H" },
  { name: "Northwind", monogram: "N" },
  { name: "Cortex", monogram: "C" },
  { name: "Meridian", monogram: "M" },
  { name: "Orbital", monogram: "O" },
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
const TICK_MS = 1900;
const FINALIZE_MS = 900;

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

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const query = window.matchMedia(REDUCED_MOTION_QUERY);
      query.addEventListener("change", callback);
      return () => query.removeEventListener("change", callback);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

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

  const reducedMotion = usePrefersReducedMotion();

  const [feed, setFeed] = useState<readonly Transaction[]>(SEED_FEED);
  const [activeCompany, setActiveCompany] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

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

      setActiveCompany(companyIndex);
      setActiveNode(zodeIndex);
      setFeed((prev) => [tx, ...prev].slice(0, FEED_LIMIT));

      finalizeTimer = setTimeout(() => {
        setFeed((prev) =>
          prev.map((row) =>
            row.id === tx.id ? { ...row, status: "finalized" } : row,
          ),
        );
        setActiveCompany(null);
        setActiveNode(null);
      }, FINALIZE_MS);
    };

    emit();
    const interval = setInterval(emit, TICK_MS);
    return () => {
      clearInterval(interval);
      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
      }
    };
  }, [companies, zodes, reducedMotion]);

  // Pulsing node markers laid over the constellation image (percent coords).
  const nodeMarkers = useMemo(
    () => [
      { left: "50%", top: "30%" },
      { left: "32%", top: "44%" },
      { left: "66%", top: "40%" },
      { left: "44%", top: "62%" },
      { left: "60%", top: "66%" },
      { left: "38%", top: "76%" },
    ],
    [],
  );

  return (
    <div className={styles.scene}>
      <header className={styles.header}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
        {section.lede && <p className={styles.lede}>{section.lede}</p>}
      </header>

      <div className={styles.grid}>
        {/* Left: companies that need compute */}
        <section className={styles.panel} aria-label="Compute demand">
          <p className={styles.panelLabel}>Compute demand</p>
          <ul className={styles.companyList}>
            {companies.map((company, index) => (
              <li
                key={company.name}
                className={styles.company}
                data-active={activeCompany === index ? "true" : undefined}
              >
                <span className={styles.companyBadge} aria-hidden="true">
                  {company.monogram}
                </span>
                <span className={styles.companyName}>{company.name}</span>
                <span className={styles.companyPing} aria-hidden="true" />
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
            <Image
              src="/images/constellation.png"
              alt="Constellation of ZODE compute nodes"
              fill
              sizes="(max-width: 900px) 80vw, 36vw"
              priority
              unoptimized
              className={styles.constellationImage}
            />
            <div className={styles.orbit} aria-hidden="true" />
            {nodeMarkers.map((marker, index) => (
              <span
                key={index}
                className={styles.node}
                style={marker}
                data-active={activeNode === index ? "true" : undefined}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className={styles.networkCaption}>
            {zodes.length} ZODEs online · routing in real time
          </p>
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
    </div>
  );
}

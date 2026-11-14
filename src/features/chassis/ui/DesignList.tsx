"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";
import { archiveDesignAction, createDesignAction } from "../actions";
import { usd } from "../model/format";
import { designHref, type DesignSummary } from "../types";
import styles from "../chassis.module.css";

const SEED = "seed";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });

function NewDesign({ designs }: { designs: DesignSummary[] }): ReactElement {
  const router = useRouter();
  const [name, setName] = useState("");
  const [from, setFrom] = useState(SEED);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={styles.newDesign}
      onSubmit={(event) => {
        event.preventDefault();
        const source = designs.find((d) => d.id === from);
        startTransition(async () => {
          const result = await createDesignAction(name, source ? { id: source.id, version: source.version } : null);
          if (result.error !== undefined) setError(result.error);
          else router.push(designHref(result.id));
        });
      }}
    >
      <input
        className={styles.search}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New design name"
        aria-label="New design name"
        maxLength={120}
        required
      />
      <select className={styles.select} value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Start from">
        <option value={SEED}>From NIRA Chassis I as issued</option>
        {designs.map((d) => (
          <option key={d.id} value={d.id}>
            Copy of {d.name}, version {d.version}
          </option>
        ))}
      </select>
      <button type="submit" className={styles.buttonPrimary} disabled={pending || !name.trim()}>
        New design
      </button>
      {error ? (
        <span className={styles.status} data-tone="error">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/** The ZODE team's chassis designs, newest edit first, archived last, and a form to start one. */
export function DesignList({ designs }: { designs: DesignSummary[] }): ReactElement {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const archive = (design: DesignSummary) => {
    if (!design.archived && !window.confirm(`Archive ${design.name}? It stays readable and can be restored.`)) return;
    startTransition(async () => {
      const result = await archiveDesignAction(design.id, !design.archived);
      setError(result.error ?? null);
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>Chassis designs</h1>
            <p className={styles.pageText}>
              ZODE pod drawing sets: parts, BOM, racks, power and cooling, drawn live as A3 sheets. Edit one, save it
              as a version, export it to PDF and send its BOM to a deployment.
            </p>
          </div>
          <NewDesign designs={designs.filter((d) => !d.archived)} />
        </div>
        {error ? (
          <p className={styles.status} data-tone="error">
            {error}
          </p>
        ) : null}

        {designs.length ? (
          <div className={styles.cards}>
            {designs.map((design) => {
              const failing = design.failingChecks;
              return (
                <article key={design.id} className={styles.card} data-archived={design.archived ? "" : undefined}>
                  <Link href={designHref(design.id)} className={styles.cardLink}>
                    <h2 className={styles.cardTitle}>{design.name}</h2>
                    <span className={styles.meta}>
                      Version {design.version} · REV {design.revision} · {design.status} · edited {when(design.updatedAt)}
                    </span>
                  </Link>
                  <div className={styles.cardFigures}>
                    <div className={styles.cardFigure}>
                      <span>BOM total</span>
                      <strong>{usd(design.totalUsd)}</strong>
                    </div>
                    <div className={styles.cardFigure}>
                      <span>Checks</span>
                      <strong className={failing ? styles.bad : undefined}>
                        {failing ? `${failing} failing` : "All pass"}
                      </strong>
                    </div>
                    <div className={styles.cardFigure}>
                      <span>Deployments</span>
                      <strong>{design.uses.length || "–"}</strong>
                    </div>
                  </div>
                  {design.uses.length ? (
                    <div className={styles.chips}>
                      {design.uses.map((use) => (
                        <Link
                          key={use.quoteId}
                          className={styles.chip}
                          href={`/portal/deployments/${use.deploymentId}?tab=quotes&quote=${encodeURIComponent(use.quoteId)}`}
                        >
                          {use.deploymentName} · v{use.version}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.rowButton} disabled={pending} onClick={() => archive(design)}>
                      {design.archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            No designs yet. Start one from NIRA Chassis I, or run <code>npm run chassis:import</code> to add it as
            issued.
          </div>
        )}
      </div>
    </div>
  );
}

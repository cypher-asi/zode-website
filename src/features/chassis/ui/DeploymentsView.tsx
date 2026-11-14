"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useState, type ReactElement } from "react";
import { attachQuoteFileAction } from "@/features/deployments/bom/actions";
import { sendToDeploymentAction } from "../actions";
import { usd } from "../model/format";
import { useDesign } from "../store";
import type { DeploymentTarget, DesignUse } from "../types";
import styles from "../chassis.module.css";
import { useDrawingSet } from "./DesignShell";
import { drawingSetName } from "./pdf";

const quoteHref = (deploymentId: string, quoteId: string) =>
  `/portal/deployments/${deploymentId}?tab=quotes&quote=${encodeURIComponent(quoteId)}`;

type Status = { tone: "ok" | "error" | "busy"; text: string; href?: string } | null;

/**
 * Where the design is used: each deployment it was sent to as a quote, and a
 * form that sends the saved version to one, onto a phase's BOM at so many
 * sets of pods, with the drawing set attached to the quote as its file.
 */
export function DeploymentsView({
  designId,
  uses,
  targets,
}: {
  designId: string;
  uses: DesignUse[];
  targets: DeploymentTarget[];
}): ReactElement {
  const version = useDesign((s) => s.baseVersion);
  const dirty = useDesign((s) => s.dirty.length > 0);
  const total = useDesign((s) => s.derived.bom.total);
  const lines = useDesign((s) => s.derived.bom.lines.length);
  const { render } = useDrawingSet();
  const [deploymentId, setDeploymentId] = useState(targets[0]?.id ?? "");
  const [phaseId, setPhaseId] = useState("");
  const [sets, setSets] = useState("1");
  const [attach, setAttach] = useState(true);
  const [status, setStatus] = useState<Status>(null);

  const target = targets.find((t) => t.id === deploymentId);
  const busy = status?.tone === "busy";
  const count = Number(sets);

  const send = async () => {
    if (!target) return;
    setStatus({ tone: "busy", text: `Writing version ${version}'s BOM into ${target.name}…` });
    const sent = await sendToDeploymentAction({
      designId,
      version,
      deploymentId: target.id,
      phaseId: phaseId || null,
      sets: count,
    });
    if (sent.error !== undefined) {
      setStatus({ tone: "error", text: sent.error });
      return;
    }
    const href = quoteHref(target.id, sent.quoteId);
    if (attach) {
      try {
        setStatus({ tone: "busy", text: "Drawing the PDF to attach…" });
        const pdf = await render();
        const name = drawingSetName(useDesign.getState().data);
        setStatus({ tone: "busy", text: "Attaching the drawing set to the quote…" });
        const blob = await upload(`deployments/${target.id}/quotes/${name}`, pdf, {
          access: "private",
          handleUploadUrl: `/api/deployments/${target.id}/quotes/upload`,
          contentType: "application/pdf",
        });
        const attached = await attachQuoteFileAction(target.id, sent.quoteId, blob.pathname, name);
        if (attached.error) {
          setStatus({ tone: "error", text: `Sent, but the PDF wasn't attached: ${attached.error}`, href });
          return;
        }
      } catch (error) {
        setStatus({ tone: "error", text: `Sent, but the PDF wasn't attached: ${String(error)}`, href });
        return;
      }
    }
    setStatus({ tone: "ok", text: `Sent version ${version} to ${target.name}.`, href });
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.pageHead}>
          <div>
            <h2 className={styles.pageTitle}>Deployments</h2>
            <p className={styles.pageText}>
              Send the design to a deployment as a quote of its {lines} BOM lines ({usd(total)} a set of pods), and
              put them on a phase&apos;s BOM. Sending again replaces what the last send wrote.
            </p>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>Sent to</h3>
          </div>
          {uses.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Deployment</th>
                    <th style={{ width: 120 }}>Version sent</th>
                    <th style={{ width: 120 }} />
                  </tr>
                </thead>
                <tbody>
                  {uses.map((use) => (
                    <tr key={use.quoteId}>
                      <td>{use.deploymentName}</td>
                      <td className={styles.mono}>
                        {use.version}
                        {use.version < version ? <span className={styles.small}> (behind)</span> : null}
                      </td>
                      <td className={styles.num}>
                        <Link className={styles.link} href={quoteHref(use.deploymentId, use.quoteId)}>
                          Open quote
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.pageText}>Not sent to a deployment yet.</p>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>Send version {version}</h3>
          </div>
          {targets.length ? (
            <form
              className={styles.sendForm}
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className={styles.row}>
                <span className={styles.rowLabel}>Deployment</span>
                <select
                  className={styles.cell}
                  value={deploymentId}
                  onChange={(event) => {
                    setDeploymentId(event.target.value);
                    setPhaseId("");
                  }}
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.row}>
                <span className={styles.rowLabel}>Phase BOM</span>
                <select className={styles.cell} value={phaseId} onChange={(event) => setPhaseId(event.target.value)}>
                  <option value="">None, only write the quote</option>
                  {target?.phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.row}>
                <span className={styles.rowLabel}>Sets of pods</span>
                <input
                  className={styles.cell}
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={sets}
                  disabled={!phaseId}
                  onChange={(event) => setSets(event.target.value)}
                />
              </label>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={attach} onChange={(event) => setAttach(event.target.checked)} />
                Attach the drawing set PDF to the quote
              </label>
              <div className={styles.inline}>
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  disabled={busy || dirty || !target || !Number.isInteger(count) || count < 1}
                >
                  Send version {version}
                </button>
                {dirty ? <span className={styles.draft}>Save your edits first to send them.</span> : null}
              </div>
              {status ? (
                <p className={styles.status} data-tone={status.tone === "busy" ? undefined : status.tone}>
                  {status.text}{" "}
                  {status.href ? (
                    <Link className={styles.link} href={status.href}>
                      Open the quote
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </form>
          ) : (
            <p className={styles.pageText}>There are no deployments to send to yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

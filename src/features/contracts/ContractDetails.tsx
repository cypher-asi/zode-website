import type { ReactElement, ReactNode } from "react";
import { FileGlyph, Icon } from "@/features/data-room/icons";
import ui from "@/features/data-room/ui.module.css";
import type { ComputeContract, Contract, MndaContract } from "./contracts";
import { OpenContract, type ContractPdf } from "./ContractViewer";
import styles from "./ContractBrowser.module.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const rate = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const signedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** A deal's `YYYY-MM-DD` date, read at noon UTC so it's the same calendar day everywhere. */
const onDay = (value: string | null): string | null => (value ? day.format(new Date(`${value}T12:00:00Z`)) : null);

const months = (value: number | null): string | null =>
  value == null ? null : `${count.format(value)} month${value === 1 ? "" : "s"}`;

type Fact = [label: string, value: ReactNode];

type ContractDocument = ContractPdf & { id: string; label: string };

/** An agreement's executed PDFs: a deal's MSA and order forms, or the one MNDA. */
function contractDocuments(contract: Contract): ContractDocument[] {
  if (contract.kind === "compute") {
    return contract.documents.map((document) => ({
      id: document.id,
      label: document.label,
      url: `/api/contracts/${contract.id}/pdf?doc=${document.id}`,
      title: `${document.label} · ${contract.counterparty}`,
      meta: `Compute deal · Signed ${day.format(contract.signedAt)}`,
    }));
  }
  return [
    {
      id: contract.id,
      label: "Executed MNDA",
      url: `/api/contracts/${contract.id}/pdf`,
      title: `Mutual NDA · ${contract.counterparty}`,
      meta: `Signed by ${contract.signerName} · ${day.format(contract.signedAt)}`,
    },
  ];
}

/** An icon for each of the agreement's PDFs, opening it in the viewer, for the right of its row. */
export function ContractPdfButtons({ contract }: { contract: Contract }): ReactElement | null {
  const documents = contractDocuments(contract);
  if (!documents.length) return null;
  return (
    <>
      {documents.map((document) => (
        <OpenContract key={document.id} className={ui.iconButton} pdf={document} label={`View ${document.label}`}>
          <FileGlyph kind="pdf" />
        </OpenContract>
      ))}
    </>
  );
}

/** A titled list of facts, leaving out the ones not recorded, or the whole list when none are. */
function Facts({ title, facts }: { title: string; facts: Fact[] }): ReactElement | null {
  const shown = facts.filter(([, value]) => value != null && value !== "");
  if (!shown.length) return null;
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <dl className={styles.facts}>
        {shown.map(([label, value]) => (
          <div key={label} className={styles.fact}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The executed PDFs: each opens in the viewer, with a download beside it. */
function Documents({ documents }: { documents: ContractDocument[] }): ReactElement {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>Documents</h3>
      {documents.length ? (
        <ul className={styles.documents}>
          {documents.map((document) => (
            <li key={document.id} className={styles.document}>
              <OpenContract className={styles.documentOpen} pdf={document}>
                <span className={styles.documentGlyph}>
                  <FileGlyph kind="pdf" />
                </span>
                <span className={styles.documentLabel}>{document.label}</span>
                <span className={styles.documentAction}>View</span>
              </OpenContract>
              <a
                className={ui.iconButton}
                href={`${document.url}${document.url.includes("?") ? "&" : "?"}download=1`}
                download
                aria-label={`Download ${document.label}`}
                title="Download"
              >
                <Icon name="download" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.none}>No documents were uploaded with this deal.</p>
      )}
    </section>
  );
}

function ComputeDetails({ contract }: { contract: ComputeContract }): ReactElement {
  const signed = day.format(contract.signedAt);
  return (
    <>
      <Facts
        title="Parties"
        facts={[
          ["Counterparty", contract.counterparty],
          ["ZODE entity", contract.providerEntity],
          ["Opportunity", contract.opportunityTitle],
          ["Site", contract.siteName],
        ]}
      />
      <Facts
        title="Dates"
        facts={[
          ["Signed", signed],
          ["Effective", onDay(contract.effectiveOn)],
          ["MSA dated", onDay(contract.msaOn)],
          ["Delivery", onDay(contract.deliveryOn)],
          ["Acceptance deadline", onDay(contract.acceptanceDeadlineOn)],
        ]}
      />
      <Facts
        title="Capacity"
        facts={[
          [
            "GPUs",
            contract.gpuCount != null
              ? `${contract.gpuCount.toLocaleString("en-US")}${contract.gpuModel ? ` × ${contract.gpuModel}` : ""}`
              : contract.gpuModel,
          ],
          ["Nodes", contract.nodeCount != null ? contract.nodeCount.toLocaleString("en-US") : null],
          ["IT load", contract.itMw != null ? `${count.format(contract.itMw)} MW` : null],
          ["Location", contract.location],
          ["Uptime", contract.uptimePct != null ? `${count.format(contract.uptimePct)}%` : null],
        ]}
      />
      <Facts
        title="Commercials"
        facts={[
          ["Structure", contract.structure],
          ["Rate", contract.gpuHourUsd != null ? `${rate.format(contract.gpuHourUsd)} per GPU-hour` : null],
          ["Monthly", contract.monthlyUsd != null ? usd.format(contract.monthlyUsd) : null],
          ["Term", months(contract.termMonths)],
          ["Renewal", months(contract.renewalMonths)],
          ["Total value", contract.valueUsd != null ? usd.format(contract.valueUsd) : null],
          [
            "Prepayment",
            contract.prepaymentUsd != null
              ? `${usd.format(contract.prepaymentUsd)}${contract.prepaymentDueOn ? `, due ${onDay(contract.prepaymentDueOn)}` : ""}`
              : null,
          ],
        ]}
      />
      <Documents documents={contractDocuments(contract)} />
    </>
  );
}

function MndaDetails({ contract, showSigner }: { contract: MndaContract; showSigner: boolean }): ReactElement {
  return (
    <>
      <Facts
        title="Agreement"
        facts={[
          ["Counterparty", contract.counterparty],
          ["Signed", signedAt.format(contract.signedAt)],
          ["Template", contract.templateVersion],
          ["Data room", contract.roomName],
          ["Account", showSigner ? (contract.linked ? "Linked to a ZOS account" : "No account") : null],
        ]}
      />
      <Facts
        title="Signer"
        facts={[
          ["Name", contract.signerName],
          ["Title", contract.signerTitle],
          [
            "Email",
            <a key="email" href={`mailto:${contract.signerEmail}`}>
              {contract.signerEmail}
            </a>,
          ],
        ]}
      />
      <Documents documents={contractDocuments(contract)} />
    </>
  );
}

/** An agreement's recorded terms and its executed PDFs, for the pane beside the list. `showSigner` adds whether the signer has an account, for the team. */
export function ContractDetails({ contract, showSigner }: { contract: Contract; showSigner: boolean }): ReactElement {
  return contract.kind === "compute" ? (
    <ComputeDetails contract={contract} />
  ) : (
    <MndaDetails contract={contract} showSigner={showSigner} />
  );
}

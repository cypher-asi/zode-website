import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import type { OrderSummary } from "@/features/configurator/orders";
import type { Contract } from "@/features/contracts/contracts";
import type { RoomSummary } from "@/features/data-room/types";
import styles from "./portal.module.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Actions on the right, e.g. "New order". */
  children?: ReactNode;
}): ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}

/** A titled block on the dashboard, with a link through to the full section. */
export function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <Link className={styles.more} href={href}>
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }): ReactElement {
  return <p className={styles.empty}>{children}</p>;
}

const Chevron = () => (
  <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

export function RoomList({ rooms }: { rooms: RoomSummary[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {rooms.map((room) => (
        <li key={room.id}>
          <Link className={styles.row} href={`/portal/data-rooms/${room.id}`} data-room="">
            <span className={styles.rowIcon}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M2.75 6A1.75 1.75 0 0 1 4.5 4.25h3.1l1.8 2h6.1A1.75 1.75 0 0 1 17.25 8v6.25A1.75 1.75 0 0 1 15.5 16h-11a1.75 1.75 0 0 1-1.75-1.75z" />
              </svg>
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{room.name}</span>
              <span className={styles.rowMeta}>
                {plural(room.fileCount, "file")} · Created {date.format(new Date(room.createdAt))}
              </span>
            </span>
            <span className={styles.rowEnd}>
              <span className={styles.pill}>{room.role === "admin" ? "Admin" : "Viewer"}</span>
              <Chevron />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OrderList({ orders }: { orders: OrderSummary[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {orders.map((order) => (
        <li key={order.reference} className={styles.row} data-order="">
          <span className={styles.rowIcon}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 2.75 16.75 6.4v7.2L10 17.25 3.25 13.6V6.4zM3.25 6.4 10 10.05l6.75-3.65M10 10.05v7.2" />
            </svg>
          </span>
          <span className={styles.rowMain}>
            <span className={styles.rowTitle}>
              <span className={styles.reference}>#{order.reference}</span> · {plural(order.gpus, "GPU")}
            </span>
            <span className={styles.rowMeta}>
              {order.platform} · {order.location} · {date.format(order.createdAt)}
              {order.totalUsd != null ? <> · {usd.format(order.totalUsd)} total</> : null}
            </span>
          </span>
          <span className={styles.rowEnd}>
            <span className={styles.amount}>
              {usd.format(order.monthlyUsd)}
              <small>{order.mode === "rent" ? " /mo est." : " /mo"}</small>
            </span>
            <span className={styles.pill} data-strong="">
              {order.mode === "rent" ? "Rent" : "Buy"}
            </span>
            <span className={styles.pill}>{order.status}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Executed agreements; each row downloads its PDF. `showSigner` adds who signed, for admins seeing everyone's. */
export function ContractList({
  contracts,
  showSigner = false,
}: {
  contracts: Contract[];
  showSigner?: boolean;
}): ReactElement {
  return (
    <ul className={styles.list}>
      {contracts.map((contract) => (
        <li key={contract.id}>
          <a className={styles.row} href={`/api/contracts/${contract.id}/pdf`} download>
            <span className={styles.rowIcon}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5.25 2.75h6.5l3.5 3.5v11h-10zM11.75 2.75v3.5h3.5M7.75 10.25h4.5M7.75 13.25h4.5" />
              </svg>
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>Mutual NDA · {contract.counterparty}</span>
              <span className={styles.rowMeta}>
                {showSigner ? `${contract.signerName} (${contract.signerEmail})` : `Signed by ${contract.signerName}`}
                {" · "}
                {date.format(contract.signedAt)}
                {contract.roomName ? <> · via {contract.roomName}</> : null}
              </span>
            </span>
            <span className={styles.rowEnd}>
              {showSigner && !contract.linked ? <span className={styles.pill}>No account</span> : null}
              <svg className={styles.chevron} viewBox="0 0 16 16" aria-label="Download PDF" role="img">
                <path d="M8 2.75v8M4.75 7.75 8 11l3.25-3.25M3.25 13.5h9.5" />
              </svg>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

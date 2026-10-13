import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import type { OrderSummary } from "@/features/configurator/orders";
import type { ComputeContract, Contract } from "@/features/contracts/contracts";
import { roleLabel, roomKindLabel, type RoomSummary } from "@/features/data-room/types";
import { SUBSCRIBER_STATUSES, mailingList, type Subscriber } from "@/features/mailing-list/types";
import { kindLabel, type Post } from "@/features/posts/types";
import { RoleButton } from "@/features/users/RoleButton";
import { ROLE_LABELS, type User } from "@/features/users/types";
import { PortalIcon } from "./icons";
import { TOOL_LINKS } from "./nav";
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
              <PortalIcon name="rooms" />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{room.name}</span>
              <span className={styles.rowMeta}>
                {roomKindLabel(room.kind)} · {plural(room.fileCount, "file")} · Created{" "}
                {date.format(new Date(room.createdAt))}
              </span>
            </span>
            <span className={styles.rowEnd}>
              <span className={styles.pill}>{roleLabel(room.role)}</span>
              <Chevron />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The site's tools, for windows too narrow for the sidebar that lists them beside Home. */
export function ToolList(): ReactElement {
  return (
    <section className={`${styles.section} ${styles.tools}`} aria-label="Tools">
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Tools</h2>
      </div>
      <ul className={styles.list}>
        {TOOL_LINKS.map((link) => (
          <li key={link.href}>
            {/* The site's tools, e.g. the cluster builder's 3D bundle, aren't worth warming up from the portal. */}
            <Link className={styles.row} href={link.href} prefetch={false}>
              <span className={styles.rowIcon}>
                <PortalIcon name={link.icon} />
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{link.label}</span>
              </span>
              <span className={styles.rowEnd}>
                <Chevron />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OrderList({ orders }: { orders: OrderSummary[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {orders.map((order) => (
        <li key={order.reference} className={styles.row} data-order="">
          <span className={styles.rowIcon}>
            <PortalIcon name="orders" />
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

/** News and changelog posts for the ZODE team; each row opens the editor. */
export function PostList({ posts }: { posts: Post[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {posts.map((post) => (
        <li key={post.id}>
          <Link className={styles.row} href={`/portal/posts/${post.id}`} data-actions="">
            <span className={styles.rowIcon}>
              <PortalIcon name="posts" />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>
                {post.title || "Untitled"}
                {post.version ? <span className={styles.reference}> · v{post.version}</span> : null}
              </span>
              <span className={styles.rowMeta}>
                {post.author.name} ·{" "}
                {post.publishedAt && post.status === "published"
                  ? `Published ${date.format(post.publishedAt)}`
                  : `Edited ${date.format(post.updatedAt)}`}
              </span>
            </span>
            <span className={styles.rowEnd}>
              <span className={styles.pill}>{kindLabel(post.kind)}</span>
              <span className={styles.pill} data-strong={post.status === "published" ? "" : undefined}>
                {post.status === "published" ? "Published" : "Draft"}
              </span>
              <Chevron />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  news: "News page",
  changelog: "Changelog page",
  post: "A post",
  settings: "Portal settings",
};

function subscriberDate(subscriber: Subscriber): string {
  if (subscriber.status === "subscribed" && subscriber.confirmedAt) return `Confirmed ${date.format(subscriber.confirmedAt)}`;
  if (subscriber.status === "unsubscribed" && subscriber.unsubscribedAt) {
    return `Unsubscribed ${date.format(subscriber.unsubscribedAt)}`;
  }
  return `Signed up ${date.format(subscriber.createdAt)}`;
}

/**
 * Mailing list rows, for ZODE admins: each address, whether it's confirmed, and
 * the account it belongs to. `showList` adds which list, when they're mixed.
 */
export function SubscriberList({
  subscribers,
  showList = false,
}: {
  subscribers: Subscriber[];
  showList?: boolean;
}): ReactElement {
  return (
    <ul className={styles.list}>
      {subscribers.map((subscriber) => {
        const name = subscriber.accountName || subscriber.name;
        return (
          <li key={subscriber.id}>
            <div className={styles.row} data-actions="">
              <span className={styles.rowIcon}>
                <PortalIcon name={subscriber.userId ? "person" : "subscribers"} />
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{subscriber.email}</span>
                <span className={styles.rowMeta}>
                  {name ? `${name} · ` : ""}
                  {subscriber.source ? `${SOURCE_LABELS[subscriber.source] ?? subscriber.source} · ` : ""}
                  {subscriberDate(subscriber)}
                </span>
              </span>
              <span className={styles.rowEnd}>
                {showList ? <span className={styles.pill}>{mailingList(subscriber.list).label}</span> : null}
                {subscriber.userId ? <span className={styles.pill}>Account</span> : null}
                <span className={styles.pill} data-strong={subscriber.status === "subscribed" ? "" : undefined}>
                  {SUBSCRIBER_STATUSES.find((status) => status.id === subscriber.status)?.label ?? subscriber.status}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Every account by ZODE user id, for super admins, with a control to grant or revoke super admin on everyone else. */
export function UserList({ users, selfZosUserId }: { users: User[]; selfZosUserId: string }): ReactElement {
  return (
    <ul className={styles.list}>
      {users.map((user) => {
        const self = user.zosUserId === selfZosUserId;
        const label = user.name || user.email || `user #${user.id}`;
        return (
          <li key={user.id}>
            <div className={styles.row} data-actions="">
              <span className={styles.rowIcon}>
                <PortalIcon name="person" />
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  <span className={styles.reference}>#{user.id}</span> · {label}
                </span>
                <span className={styles.rowMeta}>
                  {user.email && user.email !== label ? `${user.email} · ` : ""}
                  {user.lastSeenAt ? `Last seen ${date.format(user.lastSeenAt)}` : "Not seen yet"}
                </span>
              </span>
              <span className={styles.rowEnd}>
                {self ? <span className={styles.pill}>You</span> : null}
                {user.role === "member" ? null : (
                  <span className={styles.pill} data-strong={user.role === "super_admin" ? "" : undefined}>
                    {ROLE_LABELS[user.role]}
                  </span>
                )}
                {self ? null : <RoleButton userId={user.id} role={user.role} label={label} />}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const mw = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function computeMeta(contract: ComputeContract): string {
  return [
    contract.itMw != null ? `${mw.format(contract.itMw)} MW` : null,
    contract.valueUsd != null ? `${usd.format(contract.valueUsd)} total` : null,
    contract.monthlyUsd != null ? `${usd.format(contract.monthlyUsd)} /mo` : null,
    contract.termMonths != null ? plural(contract.termMonths, "month") : null,
    date.format(contract.signedAt),
    contract.siteName ? `at ${contract.siteName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Executed agreements; each row downloads its PDF. `showSigner` adds who signed, for the team seeing everyone's. */
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
              <PortalIcon name={contract.kind === "compute" ? "cluster" : "contracts"} />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>
                {contract.kind === "compute" ? "Compute contract" : "Mutual NDA"} · {contract.counterparty}
              </span>
              <span className={styles.rowMeta}>
                {contract.kind === "compute" ? (
                  computeMeta(contract)
                ) : (
                  <>
                    {showSigner
                      ? `${contract.signerName} (${contract.signerEmail})`
                      : `Signed by ${contract.signerName}`}
                    {" · "}
                    {date.format(contract.signedAt)}
                    {contract.roomName ? <> · via {contract.roomName}</> : null}
                  </>
                )}
              </span>
            </span>
            <span className={styles.rowEnd}>
              {contract.kind === "compute" ? (
                <span className={styles.pill} data-strong="">
                  {contract.mode === "rent" ? "Rent" : "Buy"}
                </span>
              ) : showSigner && !contract.linked ? (
                <span className={styles.pill}>No account</span>
              ) : null}
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

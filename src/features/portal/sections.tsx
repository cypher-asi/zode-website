import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import type { OrderSummary } from "@/features/configurator/orders";
import type { Contract } from "@/features/contracts/contracts";
import type { RoomSummary } from "@/features/data-room/types";
import { SUBSCRIBER_STATUSES, type Subscriber } from "@/features/mailing-list/types";
import { kindLabel, type Post } from "@/features/posts/types";
import { RoleButton } from "@/features/users/RoleButton";
import type { User } from "@/features/users/types";
import { PortalIcon } from "./icons";
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
                {room.kind === "lease" ? "Lease" : "Purchase"} · {plural(room.fileCount, "file")} · Created{" "}
                {date.format(new Date(room.createdAt))}
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

/** News and changelog posts for admins; each row opens the editor. */
export function PostList({ posts }: { posts: Post[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {posts.map((post) => (
        <li key={post.id}>
          <Link className={styles.row} href={`/portal/posts/${post.id}`}>
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

/** The mailing list, for ZODE admins: each address, whether it's confirmed, and the account it belongs to. */
export function SubscriberList({ subscribers }: { subscribers: Subscriber[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {subscribers.map((subscriber) => {
        const name = subscriber.accountName || subscriber.name;
        return (
          <li key={subscriber.id}>
            <div className={styles.row}>
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
            <div className={styles.row}>
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
                {user.role === "super_admin" ? (
                  <span className={styles.pill} data-strong="">
                    Super admin
                  </span>
                ) : null}
                {self ? null : <RoleButton userId={user.id} role={user.role} label={label} />}
              </span>
            </div>
          </li>
        );
      })}
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
              <PortalIcon name="contracts" />
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

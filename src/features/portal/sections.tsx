import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import type { OrderSummary } from "@/features/configurator/orders";
import type { ComputeContract, Contract } from "@/features/contracts/contracts";
import bar from "@/features/data-room/room.module.css";
import { siteMapSrc } from "@/features/data-room/rooms";
import { roomKindLabel, type PendingInvite, type RoomSummary } from "@/features/data-room/types";
import { StatusButton } from "@/features/leads/StatusButton";
import { customerOrderStatus, leadSource, leadType, statusLabel, type Lead } from "@/features/leads/types";
import { SUBSCRIBER_STATUSES, mailingList, type Subscriber } from "@/features/mailing-list/types";
import { kindLabel, type Post } from "@/features/posts/types";
import { RoleButton } from "@/features/users/RoleButton";
import { ROLE_LABELS, type User } from "@/features/users/types";
import { PortalIcon } from "./icons";
import { RoomThumb } from "./RoomThumb";
import { RESOURCE_LINKS, TOOL_LINKS, type NavLink } from "./nav";
import styles from "./portal.module.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

/**
 * Every portal page's title, with its section tabs and actions on the right,
 * always in that order so the primary action sits at the far end on every page.
 */
export function PageHeader({
  title,
  subtitle,
  tabs,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  /** The page's sections, e.g. All, Purchases and Rentals. */
  tabs?: ReactNode;
  /** Secondary actions first, then the primary one, e.g. "New order". */
  actions?: ReactNode;
}): ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {tabs || actions ? (
        <div className={bar.headerActions}>
          {tabs}
          {actions}
        </div>
      ) : null}
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
            <span className={`${styles.rowIcon} ${styles.roomThumb}`}>
              <RoomThumb
                src={room.site ? siteMapSrc(room.id, room.site) : null}
                fallback={<PortalIcon name="site" />}
              />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{room.name}</span>
              <span className={styles.rowMeta}>
                {plural(room.fileCount, "file")} · Created {date.format(new Date(room.createdAt))}
              </span>
            </span>
            <span className={styles.rowEnd}>
              <span className={styles.pill}>{roomKindLabel(room.kind)}</span>
              <Chevron />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Data room invites waiting on the account; each opens the room's join page, signing the MNDA first if it must. */
export function InviteList({ invites }: { invites: PendingInvite[] }): ReactElement {
  return (
    <section className={styles.section} aria-label="Invitations">
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Invitations</h2>
      </div>
      <ul className={styles.list}>
        {invites.map((invite) => (
          <li key={invite.memberId}>
            <Link className={styles.row} href={`/portal/data-rooms/join/${invite.memberId}`}>
              <span className={styles.rowIcon}>
                <PortalIcon name="site" />
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{invite.roomName}</span>
                <span className={styles.rowMeta}>
                  {invite.invitedBy ? `${invite.invitedBy} invited you` : "You're invited"} as{" "}
                  {invite.role === "admin" ? "an Admin" : "a Viewer"}
                </span>
              </span>
              <span className={styles.rowEnd}>
                <span className={styles.pill} data-strong="">
                  {invite.needsMnda ? "Sign MNDA to join" : "Accept"}
                </span>
                <Chevron />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SiteLinkList({ title, links }: { title: string; links: readonly NavLink[] }): ReactElement {
  return (
    <section className={`${styles.section} ${styles.tools}`} aria-label={title}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      <ul className={styles.list}>
        {links.map((link) => {
          const content = (
            <>
              <span className={styles.rowIcon}>
                <PortalIcon name={link.icon} />
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{link.label}</span>
              </span>
              <span className={styles.rowEnd}>
                <Chevron />
              </span>
            </>
          );
          return (
            <li key={link.href}>
              {link.external ? (
                <a className={styles.row} href={link.href} target="_blank" rel="noreferrer noopener">
                  {content}
                </a>
              ) : (
                /* The site's tools, e.g. the cluster builder's 3D bundle, aren't worth warming up from the portal. */
                <Link className={styles.row} href={link.href} prefetch={false}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The site's tools and resources, for windows too narrow for the sidebar that lists them beside Home. */
export function ToolList(): ReactElement {
  return (
    <>
      <SiteLinkList title="Tools" links={TOOL_LINKS} />
      <SiteLinkList title="Resources" links={RESOURCE_LINKS} />
    </>
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
            <span className={styles.pill}>{customerOrderStatus(order.status)}</span>
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

/**
 * Buy, rent and invest leads for the ZODE team: who, what they asked for, the
 * form it came through, and a control to set where the team stands with it.
 */
export function LeadList({ leads }: { leads: Lead[] }): ReactElement {
  return (
    <ul className={styles.list}>
      {leads.map((lead) => (
        <li key={`${lead.source}:${lead.id}`}>
          <div className={styles.row} data-actions="">
            <span className={styles.rowIcon}>
              <PortalIcon name={leadSource(lead.source).icon} />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>
                {lead.source === "order" ? <span className={styles.reference}>#{lead.reference} · </span> : null}
                {lead.name}
                {lead.organization ? ` · ${lead.organization}` : ""}
              </span>
              <span className={styles.rowMeta}>
                {[lead.title, lead.email, lead.phone, lead.summary, date.format(lead.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className={styles.rowEnd}>
              <span className={styles.pill}>{leadSource(lead.source).label}</span>
              {lead.types.map((type) => (
                <span key={type} className={styles.pill}>
                  {leadType(type).pill}
                </span>
              ))}
              <span className={styles.pill} data-strong={lead.status === "new" ? "" : undefined}>
                {statusLabel(lead.status)}
              </span>
              <StatusButton source={lead.source} id={lead.id} status={lead.status} label={lead.name} />
            </span>
          </div>
        </li>
      ))}
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
const rate = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const compactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });

function computeMeta(contract: ComputeContract): string {
  return [
    contract.gpuCount != null ? `${contract.gpuCount.toLocaleString("en-US")} ${contract.gpuModel ?? "GPUs"}` : null,
    contract.itMw != null ? `${mw.format(contract.itMw)} MW` : null,
    contract.gpuHourUsd != null ? `${rate.format(contract.gpuHourUsd)}/GPU-hr` : null,
    contract.termMonths != null ? plural(contract.termMonths, "month") : null,
    contract.valueUsd != null ? `${compactUsd.format(contract.valueUsd)} total` : null,
    date.format(contract.signedAt),
    contract.siteName ? `at ${contract.siteName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const downloadIcon = (
  <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 2.75v8M4.75 7.75 8 11l3.25-3.25M3.25 13.5h9.5" />
  </svg>
);

/** A compute deal, with a download link for each of its PDFs (MSA, order forms). */
function ComputeDealRow({ contract }: { contract: ComputeContract }): ReactElement {
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon}>
        <PortalIcon name="cluster" />
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>Compute deal · {contract.counterparty}</span>
        <span className={styles.rowMeta}>{computeMeta(contract)}</span>
        {contract.documents.length ? (
          <span className={styles.rowDocs}>
            {contract.documents.map((document) => (
              <a
                key={document.id}
                className={styles.rowDoc}
                href={`/api/contracts/${contract.id}/pdf?doc=${document.id}`}
                download
              >
                {downloadIcon}
                {document.label}
              </a>
            ))}
          </span>
        ) : null}
      </span>
      {contract.structure ? (
        <span className={styles.rowEnd}>
          <span className={styles.pill} data-strong="">
            {contract.structure}
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** Executed agreements; each row downloads its PDF, or a deal's PDFs. `showSigner` adds who signed, for the team seeing everyone's. */
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
          {contract.kind === "compute" ? (
            <ComputeDealRow contract={contract} />
          ) : (
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
          )}
        </li>
      ))}
    </ul>
  );
}

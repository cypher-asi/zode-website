import type { ReactElement } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { listActors, listEvents } from "@/features/data-room/audit";
import { isUuid, listFileNames, requireRoomRole } from "@/features/data-room/rooms";
import {
  AUDIT_ACTION_LABELS,
  isRoomKind,
  roomKindLabel,
  type AuditAction,
  type AuditEvent,
} from "@/features/data-room/types";
import styles from "@/features/data-room/admin.module.css";
import room from "@/features/data-room/room.module.css";
import ui from "@/features/data-room/ui.module.css";

const time = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" });

const roleName = (value: unknown) => (value === "admin" ? "Admin" : value === "viewer" ? "Viewer" : String(value ?? ""));

const kindName = (value: unknown) => (isRoomKind(value) ? roomKindLabel(value) : String(value ?? ""));

/** The subject and any detail of an event, from the snapshot taken when it happened. */
function describe(event: AuditEvent): { subject: string; detail: string } {
  const d = event.detail;
  const name = typeof d.name === "string" ? d.name : "";
  switch (event.action) {
    case "download":
      return { subject: name, detail: d.archive ? "In a zip" : "" };
    case "upload":
      return { subject: name, detail: "" };
    case "rename":
    case "room_rename":
      return { subject: String(d.to ?? ""), detail: `Was “${String(d.from ?? "")}”` };
    case "room_kind_change":
      return { subject: kindName(d.to), detail: `Was ${kindName(d.from)}` };
    case "invite":
      return { subject: String(d.email ?? ""), detail: `As ${roleName(d.role)}${d.requiresMnda ? ", MNDA required" : ""}` };
    case "mnda_sign":
      return { subject: String(d.entity ?? ""), detail: `Agreement ${String(d.mndaId ?? "")}` };
    case "invite_resend":
    case "invite_revoke":
    case "remove":
      return { subject: String(d.email ?? ""), detail: d.role ? roleName(d.role) : "" };
    case "accept":
      return { subject: String(d.email ?? ""), detail: `As ${roleName(d.role)}` };
    case "role_change":
      return { subject: String(d.email ?? ""), detail: `${roleName(d.from)} to ${roleName(d.to)}` };
    case "move":
    case "delete":
      return { subject: name, detail: d.kind === "folder" ? "Folder" : "" };
    default:
      return { subject: name, detail: "" };
  }
}

/** Admins only: who viewed, downloaded or changed what, newest first. */
export default async function DataRoomActivityPage({
  params,
  searchParams,
}: PageProps<"/portal/data-rooms/[roomId]/activity">): Promise<ReactElement> {
  const { roomId } = await params;
  await requireRoomRole(roomId, "admin");

  const search = await searchParams;
  const one = (key: string) => (typeof search[key] === "string" ? (search[key] as string) : "");
  const action = Object.hasOwn(AUDIT_ACTION_LABELS, one("action")) ? (one("action") as AuditAction) : "";
  const actor = one("actor");
  const fileId = isUuid(one("file")) ? one("file") : "";
  const page = Math.max(0, Math.floor(Number(one("page")) || 0));

  const filters = { action: action || undefined, actor: actor || undefined, fileId: fileId || undefined };
  const [{ events, hasMore }, actors, files] = await Promise.all([
    listEvents(roomId, filters, page),
    listActors(roomId),
    listFileNames(roomId),
  ]);
  const liveFiles = new Set(files.map((file) => file.id));
  const fileName = fileId ? (files.find((file) => file.id === fileId)?.name ?? "a deleted file") : "";

  const query = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const merged = { action, actor, file: fileId, page: page || undefined, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, String(value));
    const text = next.toString();
    return text ? `?${text}` : "";
  };
  const base = `/portal/data-rooms/${roomId}/activity`;

  return (
    <div className={room.scroll}>
      <div className={room.page} style={{ maxWidth: 1180 }}>
        <div className={styles.activityHeader}>
          <div>
            <h2 className={styles.heading}>Activity</h2>
            <p className={styles.lede}>
              Every view, download and change in this room. Only admins can see this.
            </p>
          </div>
          <a className={ui.button} href={`/api/data-rooms/${roomId}/activity${query({ page: undefined })}`} download>
            Export CSV
          </a>
        </div>

        <form className={styles.filters} method="get" action={base}>
          <div className={ui.field}>
            <label id="filter-action-label" htmlFor="filter-action" className={ui.label}>
              Action
            </label>
            <Select
              id="filter-action"
              aria-labelledby="filter-action-label"
              name="action"
              size="sm"
              className={styles.filterSelect}
              defaultValue={action}
              options={[
                { value: "", label: "All actions" },
                ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          <div className={ui.field}>
            <label id="filter-actor-label" htmlFor="filter-actor" className={ui.label}>
              Person
            </label>
            <Select
              id="filter-actor"
              aria-labelledby="filter-actor-label"
              name="actor"
              size="sm"
              className={styles.filterSelect}
              defaultValue={actor}
              options={[{ value: "", label: "Everyone" }, ...actors.map((email) => ({ value: email, label: email }))]}
            />
          </div>
          {fileId ? <input type="hidden" name="file" value={fileId} /> : null}
          <button type="submit" className={ui.button}>
            Filter
          </button>
          {action || actor || fileId ? (
            <Link className={styles.clear} href={base}>
              Clear filters
            </Link>
          ) : null}
        </form>
        {fileId ? (
          <p className={styles.fileFilter}>
            Showing activity for <strong>{fileName}</strong> ·{" "}
            <Link href={`${base}${query({ file: undefined, page: undefined })}`}>All files</Link>
          </p>
        ) : null}

        {events.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.events}>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Person</th>
                  <th scope="col">Action</th>
                  <th scope="col">Item</th>
                  <th scope="col">Details</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const { subject, detail } = describe(event);
                  return (
                    <tr key={event.id}>
                      <td className={styles.nowrap}>
                        <time dateTime={event.createdAt}>{time.format(new Date(event.createdAt))}</time>
                      </td>
                      <td>
                        <Link href={`${base}${query({ actor: event.actorEmail, page: undefined })}`}>{event.actorEmail}</Link>
                      </td>
                      <td>
                        <span className={styles.action} data-action={event.action}>
                          {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                        </span>
                      </td>
                      <td className={styles.subject}>
                        {event.fileId ? (
                          <Link href={`${base}${query({ file: event.fileId, page: undefined })}`} title="Show this file's activity">
                            {subject}
                          </Link>
                        ) : (
                          subject
                        )}
                        {event.fileId && liveFiles.has(event.fileId) ? (
                          <Link className={styles.open} href={`/portal/data-rooms/${roomId}?file=${event.fileId}`}>
                            Open
                          </Link>
                        ) : null}
                      </td>
                      <td className={styles.muted}>{detail}</td>
                      <td className={`${styles.muted} ${styles.nowrap}`}>{event.ip ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>No activity matches these filters.</div>
        )}

        {page > 0 || hasMore ? (
          <nav className={styles.pager} aria-label="Pages">
            {page > 0 ? (
              <Link className={ui.button} href={`${base}${query({ page: page - 1 || undefined })}`}>
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span className={styles.muted}>Page {page + 1}</span>
            {hasMore ? (
              <Link className={ui.button} href={`${base}${query({ page: page + 1 })}`}>
                Older
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

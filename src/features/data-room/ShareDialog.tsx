"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import Link from "next/link";
import { InfoTip } from "@/components/ui/InfoTip";
import { copyText } from "@/features/profile/ProfileClient";
import { isEmail } from "@/lib/validation";
import {
  createShareLinksAction,
  inviteMembersAction,
  resendShareLinkAction,
  revokeShareLinkAction,
  shareLinkDetailAction,
} from "./actions";
import { Dialog, type DialogProps } from "./Dialog";
import { Icon } from "./icons";
import {
  ROLES,
  formatEngaged,
  memberHistory,
  roleLabel,
  sharedRoomPath,
  type ActionState,
  type PersonSuggestion,
  type RoomMember,
  type ShareLink,
  type ShareLinkDetail,
} from "./types";
import styles from "./share.module.css";
import ui from "./ui.module.css";

const noSubscription = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => "";

const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". Times after `now`, arriving live, read "just now". */
function ago(iso: string, now: number): string {
  const seconds = Math.min(Math.round((new Date(iso).getTime() - now) / 1000), 0);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 86400],
    ["month", 30 * 86400],
    ["week", 7 * 86400],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function linkStats(link: ShareLink, now: number): string {
  if (!link.views) return link.sends ? "Emailed, not opened yet" : "Not opened yet";
  return [
    plural(link.views, "view"),
    plural(link.devices, "device"),
    `${formatEngaged(link.engagedMs)} viewed`,
    link.downloads ? plural(link.downloads, "download") : null,
    link.lastViewedAt ? `last ${ago(link.lastViewedAt, now)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function LinkDetailView({ roomId, link, detail }: { roomId: string; link: ShareLink; detail: ShareLinkDetail }): ReactElement {
  return (
    <div className={styles.linkDetail}>
      <div className={styles.detailGroup}>
        <h4 className={styles.detailHeading}>Visits</h4>
        {detail.visits.length ? (
          <ul className={styles.detailList}>
            {detail.visits.map((visit) => (
              <li key={visit.id} className={styles.detailItem} title={visit.ip ?? undefined}>
                <span>{when.format(new Date(visit.startedAt))}</span>
                <span className={styles.detailMeta}>
                  {[formatEngaged(visit.engagedMs), visit.device, visit.location].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailEmpty}>Not opened yet.</p>
        )}
      </div>
      <div className={styles.detailGroup}>
        <h4 className={styles.detailHeading}>Time by file</h4>
        {detail.files.length ? (
          <ul className={styles.detailList}>
            {detail.files.map((file) => (
              <li key={file.fileId} className={styles.detailItem}>
                {file.live ? (
                  <Link className={styles.detailName} href={`/portal/data-rooms/${roomId}?file=${file.fileId}`}>
                    {file.name}
                  </Link>
                ) : (
                  <span className={styles.detailName}>{file.name}</span>
                )}
                <span className={styles.detailMeta}>{formatEngaged(file.engagedMs)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailEmpty}>No files opened.</p>
        )}
      </div>
      <div className={styles.detailGroup}>
        <h4 className={styles.detailHeading}>Downloads</h4>
        {detail.downloads.length ? (
          <ul className={styles.detailList}>
            {detail.downloads.map((download) => (
              <li key={download.fileId ?? download.name} className={styles.detailItem}>
                <span className={styles.detailName}>{download.name}</span>
                <span className={styles.detailMeta}>
                  {[
                    download.count > 1 ? `${download.count} times` : null,
                    download.zipped ? "in a zip" : null,
                    when.format(new Date(download.lastAt)),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailEmpty}>Nothing downloaded.</p>
        )}
      </div>
      {link.email ? (
        <Link className={styles.manage} href={`/portal/data-rooms/${roomId}/activity?actor=${encodeURIComponent(link.email)}`}>
          Full activity
        </Link>
      ) : null}
    </div>
  );
}

interface LinkRowProps {
  roomId: string;
  link: ShareLink;
  origin: string;
  now: number;
  onResult: (result: ActionState) => void;
  onRevoke: (link: ShareLink) => void;
}

/** One recipient's link: what they've done with it, its actions, and on demand the detail behind the counts. */
function LinkRow({ roomId, link, origin, now, onResult, onRevoke }: LinkRowProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ShareLinkDetail | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, start] = useTransition();
  const url = origin ? `${origin}${sharedRoomPath(link.token)}` : "";
  const label = link.email ?? "Anyone with this link";

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) startLoading(async () => setDetail(await shareLinkDetailAction(roomId, link.id)));
  };

  return (
    <li className={styles.link}>
      <div className={styles.linkHeader}>
        <span className={styles.avatar} aria-hidden="true">
          {(link.email ?? "*").slice(0, 1).toUpperCase()}
        </span>
        <button type="button" className={styles.linkMain} aria-expanded={open} onClick={toggle}>
          <span className={styles.personEmail}>{label}</span>
          <span className={styles.linkStats}>{linkStats(link, now)}</span>
        </button>
        <div className={styles.linkActions}>
          <button
            type="button"
            className={ui.button}
            disabled={!url}
            onClick={async () => {
              if (await copyText(url)) onResult({ ok: `Copied ${link.email ? `${link.email}'s` : "the"} link.` });
            }}
          >
            Copy
          </button>
          {link.email ? (
            <button
              type="button"
              className={ui.button}
              disabled={pending}
              onClick={() => start(async () => onResult(await resendShareLinkAction(roomId, link.id)))}
            >
              Resend
            </button>
          ) : null}
          <button type="button" className={ui.button} onClick={() => onRevoke(link)}>
            Revoke
          </button>
        </div>
      </div>
      {open ? (
        detail ? (
          <LinkDetailView roomId={roomId} link={link} detail={detail} />
        ) : (
          <p className={styles.detailEmpty}>{loading ? "Loading…" : "Couldn't load this link's activity."}</p>
        )
      ) : null}
    </li>
  );
}

const SEARCH_DELAY_MS = 200;
const GAP = 4;
const EDGE = 8;
const MAX_LIST_HEIGHT = 280;

const STATUS_LABELS: Record<RoomMember["status"], string> = {
  active: "Active",
  pending: "Invite sent",
  expired: "Invite expired",
};

const splitEmails = (text: string): string[] =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Puts the suggestions under the email field, or above it when there's more room there. */
function placeList(field: HTMLElement, list: HTMLElement): void {
  const rect = field.getBoundingClientRect();
  const vh = document.documentElement.clientHeight;
  const below = vh - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const up = below < 160 && above > below;
  const s = list.style;
  s.left = `${rect.left}px`;
  s.width = `${rect.width}px`;
  s.top = up ? "auto" : `${rect.bottom + GAP}px`;
  s.bottom = up ? `${vh - rect.top + GAP}px` : "auto";
  s.maxHeight = `${Math.min(MAX_LIST_HEIGHT, up ? above : below)}px`;
  list.dataset.side = up ? "top" : "bottom";
}

interface ShareProps {
  roomId: string;
  roomName: string;
  members: RoomMember[];
  selfEmail: string;
  links: ShareLink[];
}

/** Opens the share dialog; shown to the room's admins beside its tabs. */
export function ShareButton(props: ShareProps): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={ui.button} onClick={() => setOpen(true)}>
        <Icon name="userPlus" />
        Share
      </button>
      {open ? <ShareDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * Shares the room by email: by default a membership each address signs in to,
 * or toggled to public links, each address its own link opened without an
 * account. Either way an address with a ZODE account becomes a member at once,
 * and the room joins its portal. The email field turns addresses into chips
 * and suggests people as you type: everyone ZODE knows for ZODE admins,
 * otherwise people you've invited before (see `searchPeople`).
 */
function ShareDialog({
  roomId,
  roomName,
  members,
  selfEmail,
  links,
  onClose,
}: ShareProps & { onClose: () => void }): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<PersonSuggestion[]>([]);
  const [result, setResult] = useState<ActionState>({});
  const [sending, startSending] = useTransition();
  const [mode, setMode] = useState<"member" | "link">("member");
  const [sendEmail, setSendEmail] = useState(true);
  const [linkResult, setLinkResult] = useState<ActionState>({});
  const [confirm, setConfirm] = useState<Omit<DialogProps, "onClose"> | null>(null);
  const origin = useSyncExternalStore(noSubscription, browserOrigin, serverOrigin);
  const [now] = useState(() => Date.now());

  const query = text.trim().toLowerCase();
  // The last results, narrowed to what's typed now, stand in until the next search answers.
  const suggestions = query
    ? results.filter(
        (p) => !chips.includes(p.email) && (p.email.includes(query) || p.name?.toLowerCase().includes(query)),
      )
    : [];
  const listOpen = focused && !dismissed && suggestions.length > 0;
  const activeIndex = active < suggestions.length ? active : -1;

  const emails = [...new Set([...chips, ...splitEmails(text)])];
  // Only committed chips are checked, so a name being typed isn't flagged.
  const invalid = chips.filter((email) => !isEmail(email));
  const submitLabel =
    mode === "member"
      ? sending
        ? "Sending…"
        : "Send invites"
      : sending
        ? "Sharing…"
        : sendEmail
          ? "Create and send links"
          : "Create links";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal focuses the first control, which is the close button.
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/data-rooms/${roomId}/people?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.ok) setResults((await res.json()) as PersonSuggestion[]);
      } catch {
        // Aborted by the next keystroke, or offline; the last suggestions stay.
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, roomId]);

  // The list sits in the top layer so the dialog's own scrolling can't clip it; it's placed under the field each render.
  useLayoutEffect(() => {
    const list = listRef.current;
    const field = fieldRef.current;
    if (!list || !field) return;
    if (!listOpen) {
      if (list.matches(":popover-open")) list.hidePopover();
      return;
    }
    placeList(field, list);
    if (!list.matches(":popover-open")) list.showPopover();
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  });

  useEffect(() => {
    if (!listOpen) return;
    const follow = () => {
      if (fieldRef.current && listRef.current) placeList(fieldRef.current, listRef.current);
    };
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, { capture: true });
      window.removeEventListener("resize", follow);
    };
  }, [listOpen]);

  const commit = (tokens: string[]) => {
    if (tokens.length) setChips((prev) => [...new Set([...prev, ...tokens])]);
    setText("");
    setActive(-1);
  };

  const pick = (person: PersonSuggestion) => commit([person.email]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = suggestions.length - 1;
    switch (event.key) {
      case "ArrowDown":
        if (!suggestions.length) return;
        setDismissed(false);
        setActive(activeIndex >= last ? 0 : activeIndex + 1);
        break;
      case "ArrowUp":
        if (!suggestions.length) return;
        setDismissed(false);
        setActive(activeIndex <= 0 ? last : activeIndex - 1);
        break;
      case "Escape":
        // Closes just the list, not the dialog.
        if (!listOpen) return;
        setDismissed(true);
        setActive(-1);
        break;
      case "Enter":
        // A typed name, rather than an address, takes the top suggestion.
        if (listOpen && (activeIndex >= 0 || !text.includes("@"))) pick(suggestions[Math.max(activeIndex, 0)]);
        else if (query) commit(splitEmails(text));
        // An empty field lets Enter submit the form.
        else return;
        break;
      case "Tab":
        if (!listOpen || activeIndex < 0) return;
        pick(suggestions[activeIndex]);
        break;
      case " ":
        // Names have spaces; only an address is ended by one.
        if (!text.includes("@")) return;
        commit(splitEmails(text));
        break;
      case ",":
      case ";":
        commit(splitEmails(text));
        break;
      case "Backspace":
        if (text || !chips.length) return;
        setChips((prev) => prev.slice(0, -1));
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!/[\s,;]/.test(pasted.trim())) return;
    event.preventDefault();
    commit(splitEmails(`${text} ${pasted}`));
  };

  return (
    <dialog
      ref={dialogRef}
      className={`${ui.dialog} ${styles.dialog}`}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <form
        className={ui.dialogForm}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const action = mode === "member" ? inviteMembersAction : createShareLinksAction;
          startSending(async () => {
            const outcome = await action(roomId, {}, form);
            setResult(outcome);
            if (outcome.ok) {
              setChips([]);
              setText("");
            }
          });
        }}
      >
        <div className={styles.header}>
          <h2 id={`${id}-title`} className={ui.dialogTitle}>
            Share {roomName}
          </h2>
          <button
            type="button"
            className={ui.iconButton}
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className={styles.modes} role="group" aria-label="Share as">
          {(
            [
              ["member", "Members", null],
              ["link", "Public links", links.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              className={styles.mode}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setResult({});
              }}
            >
              {label}
              {count ? <span className={styles.count}>{count}</span> : null}
            </button>
          ))}
        </div>
        <p className={ui.dialogText}>
          {mode === "member"
            ? "Each person gets a personal link and signs in, or creates a ZODE account, with that address. Anyone who already has an account is added now and sees the room in their portal."
            : "Each person gets their own link to browse and download, without a ZODE account. You'll see when they open it, how long they spend on each file and what they download. Anyone who already has a ZODE account is added as a member instead."}
        </p>

        <div className={ui.field}>
          <label htmlFor={`${id}-input`} className={ui.label}>
            Emails
          </label>
          <div
            ref={fieldRef}
            className={styles.chipField}
            onClick={(event) => {
              if (event.target === event.currentTarget) event.currentTarget.querySelector("input")?.focus();
            }}
          >
            {chips.map((email) => (
              <span key={email} className={styles.chip} data-invalid={!isEmail(email) || undefined}>
                {email}
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`Remove ${email}`}
                  onClick={() => setChips((prev) => prev.filter((c) => c !== email))}
                >
                  <Icon name="close" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              id={`${id}-input`}
              className={styles.chipInput}
              value={text}
              placeholder={chips.length ? "" : "Name or email"}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={listId}
              aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
              onChange={(event) => {
                setText(event.target.value);
                setDismissed(false);
                setActive(-1);
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                commit(splitEmails(text));
              }}
            />
          </div>
          <input type="hidden" name="emails" value={emails.join(", ")} />
          <ul ref={listRef} id={listId} className={styles.suggestions} popover="manual" role="listbox" aria-label="Suggestions">
            {suggestions.map((person, index) => (
              <li
                key={person.email}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                className={styles.suggestion}
                data-active={index === activeIndex || undefined}
                onPointerMove={() => {
                  if (index !== activeIndex) setActive(index);
                }}
                // Keeps focus in the field, so picking doesn't blur and commit the half-typed text first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(person)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {(person.name || person.email).slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.suggestionText}>
                  {person.name ? <span className={styles.suggestionName}>{person.name}</span> : null}
                  <span className={styles.suggestionEmail}>{person.email}</span>
                </span>
              </li>
            ))}
          </ul>
          {invalid.length ? (
            <p className={ui.error}>
              {invalid.length === 1 ? `${invalid[0]} isn't a valid email.` : `${invalid.length} addresses aren't valid.`}
            </p>
          ) : null}
        </div>

        <fieldset className={styles.roles}>
          <legend className={ui.label}>{mode === "member" ? "Access" : "Access for ZODE accounts"}</legend>
          {ROLES.map((role) => (
            <label key={role.id} className={styles.roleOption}>
              <input type="radio" name="role" value={role.id} defaultChecked={role.id === "viewer"} />
              <span>
                <strong>{role.label}</strong>
                <span>{role.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className={styles.roleOption}>
          <input type="checkbox" name="requireMnda" defaultChecked />
          <span>
            <strong>Require the mutual NDA</strong>
            <span>
              {mode === "member" ? "Invitees" : "People with a ZODE account"} sign ZODE&apos;s MNDA before they can open
              the room. Anyone who already signed one isn&apos;t asked again.
            </span>
          </span>
        </label>

        {mode === "link" ? (
          <label className={styles.roleOption}>
            <input
              type="checkbox"
              name="sendEmail"
              checked={sendEmail}
              onChange={(event) => setSendEmail(event.target.checked)}
            />
            <span>
              <strong>Email each person their link</strong>
              <span>Otherwise copy the links below and send them yourself.</span>
            </span>
          </label>
        ) : null}

        <div className={styles.footer}>
          {result.error ? <p className={ui.error}>{result.error}</p> : null}
          {result.ok ? <p className={ui.ok}>{result.ok}</p> : null}
          <button type="submit" className={ui.primary} disabled={sending || !emails.length || invalid.length > 0}>
            {submitLabel}
          </button>
        </div>

        {mode === "link" ? (
          <section className={styles.public} aria-labelledby={`${id}-links`}>
            <h3 id={`${id}-links`} className={styles.peopleHeading}>
              Links <span className={styles.count}>{links.length}</span>
            </h3>
            {linkResult.error ? <p className={ui.error}>{linkResult.error}</p> : null}
            {linkResult.ok ? <p className={ui.ok}>{linkResult.ok}</p> : null}
            {links.length ? (
              <ul className={styles.peopleList}>
                {links.map((link) => (
                  <LinkRow
                    key={link.id}
                    roomId={roomId}
                    link={link}
                    origin={origin}
                    now={now}
                    onResult={setLinkResult}
                    onRevoke={(target) =>
                      setConfirm({
                        title: "Revoke link?",
                        description: `${target.email ? `${target.email}'s link` : "The link"} stops opening ${roomName} immediately. What they did with it stays in the activity.`,
                        confirmLabel: "Revoke",
                        danger: true,
                        onConfirm: async () => {
                          const outcome = await revokeShareLinkAction(roomId, target.id);
                          setLinkResult(outcome);
                          return outcome.error;
                        },
                      })
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.publicText}>No links yet. Add an email above to create one.</p>
            )}
          </section>
        ) : null}

        <section className={styles.people} aria-labelledby={`${id}-people`}>
          <div className={styles.peopleHeader}>
            <h3 id={`${id}-people`} className={styles.peopleHeading}>
              People with access <span className={styles.count}>{members.length}</span>
            </h3>
            <Link
              href={`/portal/data-rooms/${roomId}/members`}
              className={styles.manage}
              onClick={() => dialogRef.current?.close()}
            >
              Manage members
            </Link>
          </div>
          <ul className={styles.peopleList}>
            {members.map((member) => (
              <li key={member.id} className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">
                  {member.email.slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.personEmail}>
                  {member.email}
                  {member.email === selfEmail ? <span className={styles.you}>You</span> : null}
                </span>
                <InfoTip rows={memberHistory(member)} label={`Invite details for ${member.email}`} />
                {member.status !== "active" ? (
                  <span className={styles.status} data-status={member.status}>
                    {STATUS_LABELS[member.status]}
                  </span>
                ) : member.email === selfEmail ? null : member.lastOpenedAt ? (
                  <span className={styles.opened}>Opened {ago(member.lastOpenedAt, now)}</span>
                ) : (
                  <span className={styles.status} data-status="unopened">
                    Not opened yet
                  </span>
                )}
                <span className={styles.personRole}>{roleLabel(member.role)}</span>
              </li>
            ))}
          </ul>
        </section>
      </form>
      {confirm ? <Dialog {...confirm} onClose={() => setConfirm(null)} /> : null}
    </dialog>
  );
}

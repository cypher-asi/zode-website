import "server-only";
import { Client } from "@neondatabase/serverless";
import type { Account } from "@/features/account/zos";
import { devDbTarget } from "@/lib/db";
import { normalizeEmail } from "./rooms";

/** Raised by the triggers on data_room_members and data_rooms (db/schema.sql) with `{ u: user_id, e: email }`. */
const CHANNEL = "data_room_access";

const RECONNECT_MS = 2_000;
/** How long the connection outlives its last subscriber, so a page reloading doesn't reconnect. */
const IDLE_CLOSE_MS = 30_000;

interface Subscriber {
  userId: string;
  email: string;
  /** Something may have changed; also called after a dropped connection, when changes may have been missed. */
  onChange: () => void;
}

interface Hub {
  url: string;
  subscribers: Set<Subscriber>;
  client: Promise<Client> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

/** Shared across the server's module instances and survives HMR, so each server holds one connection per database. */
const HUBS_KEY = Symbol.for("zode.dataRoomLiveHubs");
const store = globalThis as typeof globalThis & { [HUBS_KEY]?: Map<string, Hub> };
const hubs = (store[HUBS_KEY] ??= new Map());

/**
 * The database `db()` reads, unpooled: LISTEN needs a session of its own,
 * which Neon's pooler (PgBouncer in transaction mode) doesn't keep.
 */
function listenUrl(): string {
  const url =
    devDbTarget() === "prod"
      ? process.env.DATABASE_URL_PROD
      : (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
  if (!url) throw new Error("DATABASE_URL is not configured");
  return url.replace("-pooler.", ".");
}

function hubFor(url: string): Hub {
  let hub = hubs.get(url);
  if (!hub) {
    hub = { url, subscribers: new Set(), client: null, idleTimer: null, retryTimer: null };
    hubs.set(url, hub);
  }
  return hub;
}

function dispatch(hub: Hub, payload: string | undefined): void {
  let target: { u?: unknown; e?: unknown };
  try {
    target = JSON.parse(payload ?? "") as { u?: unknown; e?: unknown };
  } catch {
    return;
  }
  for (const sub of hub.subscribers) {
    if ((typeof target.u === "string" && target.u === sub.userId) || (typeof target.e === "string" && target.e === sub.email)) {
      sub.onChange();
    }
  }
}

function connect(hub: Hub): Promise<Client> {
  if (hub.client) return hub.client;
  const client = new Client({ connectionString: hub.url });
  // Set below; a drop before then (a synchronous failure) has nothing of its own to clear.
  const own: { ready?: Promise<Client> } = {};
  let dropped = false;
  const drop = (error?: unknown) => {
    if (dropped) return;
    dropped = true;
    if (error) console.error("[data-room live] listener connection lost", error);
    if (hub.client === own.ready) hub.client = null;
    client.end().catch(() => {});
    if (!hub.subscribers.size || hub.retryTimer) return;
    hub.retryTimer = setTimeout(() => {
      hub.retryTimer = null;
      if (!hub.subscribers.size) return;
      // Anything raised while disconnected was missed, so every subscriber rechecks once listening again.
      connect(hub).then(
        () => hub.subscribers.forEach((sub) => sub.onChange()),
        () => {},
      );
    }, RECONNECT_MS);
  };
  client.on("notification", (message) => {
    if (message.channel === CHANNEL) dispatch(hub, message.payload);
  });
  client.on("error", drop);
  client.on("end", () => drop());
  const ready = (async () => {
    try {
      await client.connect();
      await client.query(`listen ${CHANNEL}`);
      return client;
    } catch (error) {
      drop(error);
      throw error;
    }
  })();
  own.ready = ready;
  hub.client = ready;
  return ready;
}

/**
 * Calls `onChange` whenever the account's rooms or the invites to its email
 * may have changed, from any server. Resolves once listening, so a check made
 * after it can't miss a change; rejects when the database can't be reached.
 * The returned function unsubscribes.
 */
export async function subscribeToRoomAccess(account: Account, onChange: () => void): Promise<() => void> {
  const hub = hubFor(listenUrl());
  const sub: Subscriber = { userId: account.userId, email: normalizeEmail(account.email), onChange };
  hub.subscribers.add(sub);
  if (hub.idleTimer) {
    clearTimeout(hub.idleTimer);
    hub.idleTimer = null;
  }
  const unsubscribe = () => {
    if (!hub.subscribers.delete(sub) || hub.subscribers.size || hub.idleTimer) return;
    hub.idleTimer = setTimeout(() => {
      hub.idleTimer = null;
      if (hub.subscribers.size || !hub.client) return;
      const closing = hub.client;
      hub.client = null;
      closing.then((client) => client.end()).catch(() => {});
    }, IDLE_CLOSE_MS);
  };
  try {
    await connect(hub);
  } catch (error) {
    unsubscribe();
    throw error;
  }
  return unsubscribe;
}

import { getAccount } from "@/features/account/session";
import { roomsVersion } from "@/features/data-room/invites";
import { subscribeToRoomAccess } from "@/features/data-room/live";

/** Vercel ends a function at its max duration; the stream closes first and the browser reconnects. */
export const maxDuration = 300;
const STREAM_MS = 280_000;
/** Keeps proxies from closing an idle stream. */
const HEARTBEAT_MS = 25_000;
const RETRY_MS = 2_000;
/** While the database can't be listened to, browsers wait longer before trying again. */
const UNAVAILABLE_RETRY_MS = 15_000;

/**
 * Server-sent events for the signed-in account: a `rooms` event carrying the
 * fingerprint of its rooms and invites on connecting, and again whenever that
 * changes, so an open portal refreshes as soon as a room is shared with it.
 */
export async function GET(request: Request): Promise<Response> {
  const account = await getAccount();
  if (!account) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });

  const encoder = new TextEncoder();
  let close = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let last = "";
      let running = false;
      let rerun = false;
      let unsubscribe = () => {};

      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      const expiry = setTimeout(() => close(), STREAM_MS);
      close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(expiry);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };
      request.signal.addEventListener("abort", () => close());

      // Notifications can arrive in bursts (a batch of invites), so checks run one at a time.
      const check = async () => {
        if (running) {
          rerun = true;
          return;
        }
        running = true;
        try {
          do {
            rerun = false;
            const version = await roomsVersion(account);
            if (version !== last) {
              last = version;
              send(`event: rooms\ndata: ${version}\n\n`);
            }
          } while (rerun && !closed);
        } catch (error) {
          console.error("[data-room events] couldn't check rooms", error);
        } finally {
          running = false;
        }
      };

      try {
        unsubscribe = await subscribeToRoomAccess(account, () => void check());
      } catch (error) {
        console.error("[data-room events] couldn't listen for changes", error);
        send(`retry: ${UNAVAILABLE_RETRY_MS}\n\n`);
        close();
        return;
      }
      if (closed) {
        unsubscribe();
        return;
      }
      send(`retry: ${RETRY_MS}\n\n`);
      await check();
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { roomBlobPrefix } from "@/features/data-room/blob";
import { isSameOrigin, notFoundResponse } from "@/features/data-room/http";
import { ROOM_QUOTA_BYTES, roomAccess, roomUsage } from "@/features/data-room/rooms";

const MAX_UPLOAD_BYTES = 5 * 1024 ** 3;

/**
 * Issues short-lived client tokens so admins' browsers upload straight to the
 * private Blob store, past the function body size limit. Tokens only cover this
 * room's prefix, and no file may exceed the room's remaining quota; the file
 * is recorded afterwards by `registerUploadAction`.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/data-rooms/[roomId]/upload">) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId, "admin");
  if (!access) return notFoundResponse();

  const body = (await request.json()) as HandleUploadBody;
  if (body.type !== "blob.generate-client-token") return new Response("Bad request", { status: 400 });

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(roomBlobPrefix(roomId)) || pathname.includes("..")) {
          throw new Error("Uploads must go into this room.");
        }
        const remaining = ROOM_QUOTA_BYTES - (await roomUsage(roomId));
        if (remaining <= 0) throw new Error("This room is full. Delete some files to make space.");
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: Math.min(MAX_UPLOAD_BYTES, remaining),
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}

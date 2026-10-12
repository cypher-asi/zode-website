import type { NextRequest } from "next/server";
import { notFoundResponse } from "@/features/data-room/http";
import { searchPeople } from "@/features/data-room/people";
import { roomAccess } from "@/features/data-room/rooms";

/** Suggestions for the share dialog's email field. Room admins only. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/data-rooms/[roomId]/people">) {
  const { roomId } = await ctx.params;
  const access = await roomAccess(roomId, "admin");
  if (!access) return notFoundResponse();

  const people = await searchPeople(access.account, roomId, request.nextUrl.searchParams.get("q") ?? "");
  return Response.json(people, { headers: { "Cache-Control": "private, no-store" } });
}

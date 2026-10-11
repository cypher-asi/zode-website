import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_DISABLED, SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const UNLOCK_PATH = "/unlock";

/**
 * Gate every page behind the shared-password session cookie (Next 16
 * renamed Middleware to Proxy). Unauthenticated requests are
 * redirected to `/unlock`; an already-authenticated visitor hitting
 * `/unlock` is bounced back to the gated page. Runs on the Node.js
 * runtime, so `node:crypto`-based verification works here.
 */
export function proxy(request: NextRequest): NextResponse {
  // Password gate temporarily disabled: let every request through.
  if (AUTH_DISABLED) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = verifySessionToken(token);

  if (pathname === UNLOCK_PATH) {
    if (authed) {
      return NextResponse.redirect(new URL("/", request.nextUrl));
    }
    return NextResponse.next();
  }

  if (!authed) {
    const unlockUrl = new URL(UNLOCK_PATH, request.nextUrl);
    return NextResponse.redirect(unlockUrl);
  }

  return NextResponse.next();
}

export const config = {
  // `.well-known` stays public so security.txt is reachable even while the
  // password gate is on.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|\\.well-known|.*\\.svg$).*)",
  ],
};

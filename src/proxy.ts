import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const LOGIN_PATH = "/login";

/**
 * Gate every page behind the shared-password session cookie (Next 16
 * renamed Middleware to Proxy). Unauthenticated requests are
 * redirected to `/login`; an already-authenticated visitor hitting
 * `/login` is bounced back to the gated page. Runs on the Node.js
 * runtime, so `node:crypto`-based verification works here.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = verifySessionToken(token);

  if (pathname === LOGIN_PATH) {
    if (authed) {
      return NextResponse.redirect(new URL("/", request.nextUrl));
    }
    return NextResponse.next();
  }

  if (!authed) {
    const loginUrl = new URL(LOGIN_PATH, request.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};

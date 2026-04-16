import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always pass through any API routes before session checks.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Extra safety: never interfere with login or static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  const sessionToken =
    req.cookies.get("next-auth.session-token")?.value ??
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (sessionToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  const callbackUrl = pathname + search;
  loginUrl.searchParams.set("callbackUrl", callbackUrl);

  return NextResponse.redirect(loginUrl);
}

export const proxyConfig = {
  // Only run on /ae/* routes and skip /login, /api/auth/*, and static assets
  matcher: ["/ae/:path*"],
};

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PAGE_PREFIXES = ["/me", "/onboarding"];
const ADMIN_PAGE_PREFIX = "/admin";
const SESSION_COOKIE = "gameindex-auth-token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(ADMIN_PAGE_PREFIX)) {
    return handleAdmin(request);
  }

  if (!PROTECTED_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const cookieToken = request.cookies.get(SESSION_COOKIE)?.value;
  const headerToken = request.headers.get("authorization")?.toLowerCase().startsWith("bearer ");

  if (cookieToken || headerToken) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

function handleAdmin(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const claims = decodeTokenClaims(token);
  if (!claims || claims.isAdmin !== true || isExpired(claims.exp)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function decodeTokenClaims(token: string): { isAdmin?: boolean; exp?: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpired(exp: number | undefined) {
  if (typeof exp !== "number") return true;
  return exp < Math.floor(Date.now() / 1000);
}

export const config = {
  matcher: ["/me/:path*", "/onboarding/:path*", "/admin/:path*"]
};

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PAGE_PREFIXES = ["/me", "/onboarding"];
const SESSION_COOKIE = "gameindex-auth-token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

export const config = {
  matcher: ["/me/:path*", "/onboarding/:path*"]
};

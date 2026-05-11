import { NextResponse } from "next/server";

export function jsonError(message: string, status: number, extras?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extras ?? {}) }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, init);
}

export function publicCacheHeaders({ sMaxAge = 60, swr = 600 }: { sMaxAge?: number; swr?: number } = {}) {
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
  };
}

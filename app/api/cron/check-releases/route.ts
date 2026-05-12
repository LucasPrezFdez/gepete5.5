import { NextResponse } from "next/server";
import { fanoutWishlistReleases } from "@/services/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await fanoutWishlistReleases();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar la cola de lanzamientos." },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice("bearer ".length).trim();
    if (token === expected) return true;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken === expected) return true;

  return false;
}

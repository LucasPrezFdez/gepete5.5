import { NextResponse } from "next/server";
import type { Game } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import {
  ensureGame,
  ensureProfile,
  getUserFromRequest,
  recalculateGameStats,
  recordActivity,
  reviewFromRow
} from "@/services/community";

export const dynamic = "force-dynamic";

const MIN_TITLE_LENGTH = 3;
const MIN_BODY_LENGTH = 20;
const MAX_BODY_LENGTH = 8000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameSlug = searchParams.get("gameSlug") ?? undefined;
  const username = searchParams.get("username") ?? undefined;
  const page = getPositiveInteger(searchParams.get("page"), 1);
  const pageSize = getPositiveInteger(searchParams.get("pageSize"), 20);
  const serviceClient = createServiceDatabaseClient();

  let query = serviceClient
    .from("reviews")
    .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), games:game_id(slug,title)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (gameSlug) query = query.eq("games.slug", gameSlug);
  if (username) query = query.eq("profiles.username", username);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    reviews: (data ?? []).filter((row: any) => row.games && row.profiles).map(reviewFromRow),
    count: count ?? 0,
    page,
    pageSize
  });
}

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const title = String(payload?.title ?? "").trim();
  const body = String(payload?.body ?? "").trim();
  const score = Number(payload?.score);
  const hasSpoilers = Boolean(payload?.hasSpoilers);
  const game = payload?.game as Partial<Game> | undefined;
  const gameSlug = String(payload?.gameSlug ?? game?.slug ?? "").trim();

  if (!gameSlug) return NextResponse.json({ error: "Falta gameSlug." }, { status: 400 });
  if (title.length < MIN_TITLE_LENGTH) return NextResponse.json({ error: "El título es demasiado corto." }, { status: 400 });
  if (body.length < MIN_BODY_LENGTH || body.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: `La reseña debe tener entre ${MIN_BODY_LENGTH} y ${MAX_BODY_LENGTH} caracteres.` }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return NextResponse.json({ error: "La puntuación debe estar entre 1 y 10." }, { status: 400 });
  }

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const dbGame = await ensureGame(serviceClient, gameSlug, game);
  const now = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("reviews")
    .insert({
      game_id: dbGame.id,
      user_id: auth.user.id,
      title,
      body,
      score,
      has_spoilers: hasSpoilers,
      updated_at: now
    })
    .select("id")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "No se pudo guardar la reseña." }, { status: 500 });

  await Promise.allSettled([
    recalculateGameStats(serviceClient, dbGame.id),
    recordActivity(serviceClient, {
      userId: auth.user.id,
      gameId: dbGame.id,
      reviewId: data.id,
      type: "review",
      message: `publicó una reseña de ${dbGame.title}`
    })
  ]);

  return NextResponse.json({ ok: true, reviewId: data.id });
}

function getPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}






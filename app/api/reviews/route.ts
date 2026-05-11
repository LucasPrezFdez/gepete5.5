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
import { jsonError, jsonOk, publicCacheHeaders } from "@/lib/api";
import { parse, v } from "@/lib/validation";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/reviews");

const reviewSchema = {
  title: v.string({ min: 3, max: 160 }),
  body: v.string({ min: 20, max: 8000 }),
  score: v.integer({ min: 1, max: 10 }),
  hasSpoilers: v.boolean({ defaultValue: false }),
  gameSlug: v.string({ min: 1, max: 200, optional: true })
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameSlug = searchParams.get("gameSlug") ?? undefined;
  const username = searchParams.get("username") ?? undefined;
  const page = getPositiveInteger(searchParams.get("page"), 1);
  const pageSize = clampPageSize(searchParams.get("pageSize"), 20);
  const serviceClient = createServiceDatabaseClient();

  let query = serviceClient
    .from("reviews")
    .select(
      "*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), games:game_id(slug,title)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (gameSlug) query = query.eq("games.slug", gameSlug);
  if (username) query = query.eq("profiles.username", username);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) {
    log.error("reviews query failed", { reason: error.message });
    return jsonError(error.message, 500);
  }

  return jsonOk(
    {
      reviews: (data ?? [])
        .filter((row: any) => row.games && row.profiles)
        .map(reviewFromRow),
      count: count ?? 0,
      page,
      pageSize
    },
    { headers: publicCacheHeaders({ sMaxAge: 30, swr: 300 }) }
  );
}

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return jsonError(auth.error ?? "No autenticado.", 401);

  const payload = await request.json().catch(() => null);
  const parsed = parse(reviewSchema, payload);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const game = (payload as any)?.game as Partial<Game> | undefined;
  const slug = (parsed.value.gameSlug ?? game?.slug ?? "").trim();
  if (!slug) return jsonError("Falta gameSlug.", 400);

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const dbGame = await ensureGame(serviceClient, slug, game);
  const now = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("reviews")
    .insert({
      game_id: dbGame.id,
      user_id: auth.user.id,
      title: parsed.value.title,
      body: parsed.value.body,
      score: parsed.value.score,
      has_spoilers: parsed.value.hasSpoilers,
      updated_at: now
    })
    .select("id")
    .single();

  if (error || !data) {
    log.error("review insert failed", { reason: error?.message });
    return jsonError(error?.message ?? "No se pudo guardar la reseña.", 500);
  }

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

  return jsonOk({ ok: true, reviewId: data.id });
}

function getPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function clampPageSize(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 100);
}

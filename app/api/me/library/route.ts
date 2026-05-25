import { NextResponse } from "next/server";
import type { Game, UserGameStatus } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import {
  ensureGame,
  ensureProfile,
  getUserFromRequest,
  recordActivity,
  VALID_LIBRARY_STATUSES
} from "@/services/community";
import { syncDefaultProfileLists } from "@/services/lists";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const gameSlug = searchParams.get("gameSlug") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);

  let query = serviceClient
    .from("user_game_statuses")
    .select("status, created_at, games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (gameSlug) query = query.eq("games.slug", gameSlug);
  if (status && VALID_LIBRARY_STATUSES.includes(status as UserGameStatus)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profileRow } = await serviceClient
    .from("profiles")
    .select("featured_game_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  let featuredGameSlug: string | null = null;
  if (profileRow?.featured_game_id) {
    const { data: gameRow } = await serviceClient
      .from("games")
      .select("slug")
      .eq("id", profileRow.featured_game_id)
      .maybeSingle();
    featuredGameSlug = gameRow?.slug ?? null;
  }

  return NextResponse.json({
    featuredGameSlug,
    statuses: (data ?? []).map((item: any) => ({
      status: item.status,
      createdAt: item.created_at,
      game: item.games ? gameFromMinimalRow(item.games) : null
    }))
  });
}

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const status = String(payload?.status ?? "") as UserGameStatus;
  const game = payload?.game as Partial<Game> | undefined;
  const gameSlug = String(payload?.gameSlug ?? game?.slug ?? "").trim();
  const enabled = payload?.enabled !== false;

  if (!VALID_LIBRARY_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Estado de biblioteca no válido." }, { status: 400 });
  }
  if (!gameSlug) {
    return NextResponse.json({ error: "Falta gameSlug." }, { status: 400 });
  }

  const serviceClient = createServiceDatabaseClient();
  await ensureProfile(serviceClient, auth.user);
  const dbGame = await ensureGame(serviceClient, gameSlug, game);

  if (!enabled) {
    const { error } = await serviceClient
      .from("user_game_statuses")
      .delete()
      .eq("game_id", dbGame.id)
      .eq("user_id", auth.user.id)
      .eq("status", status);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await syncDefaultProfileLists(serviceClient, {
      id: auth.user.id,
      username: auth.user.user_metadata.username
    }).catch(() => null);
    return NextResponse.json({ ok: true, enabled: false, status });
  }

  const { error } = await serviceClient.from("user_game_statuses").upsert(
    {
      game_id: dbGame.id,
      user_id: auth.user.id,
      status
    },
    { onConflict: "game_id,user_id,status" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordActivity(serviceClient, {
    userId: auth.user.id,
    gameId: dbGame.id,
    type: status === "favorite" ? "favorite" : "status",
    message: status === "favorite" ? `marcó ${dbGame.title} como favorito` : `actualizó ${dbGame.title} en su biblioteca`
  }).catch(() => null);
  await syncDefaultProfileLists(serviceClient, {
    id: auth.user.id,
    username: auth.user.user_metadata.username
  }).catch(() => null);

  return NextResponse.json({ ok: true, enabled: true, status });
}

function gameFromMinimalRow(row: any): Game {
  return {
    title: row.title,
    slug: row.slug,
    year: Number(row.release_year ?? 0),
    platforms: [],
    genres: [],
    developer: "Desarrolladora no disponible",
    publisher: "Publisher no disponible",
    userScore: Number(row.user_score ?? 0),
    criticScore: row.critic_score === null || row.critic_score === undefined ? null : Number(row.critic_score),
    reviews: Number(row.review_count ?? 0),
    ratings: Number(row.rating_count ?? 0),
    status: row.status === "upcoming" || row.status === "early_access" ? row.status : "released",
    coverUrl: row.cover_url ?? "",
    heroUrl: row.hero_url ?? row.cover_url ?? "",
    summary: row.summary ?? "Sinopsis no disponible.",
    modes: [],
    releaseDate: row.release_year ? String(row.release_year) : "Fecha por anunciar"
  };
}


import { NextResponse } from "next/server";
import { createServiceDatabaseClient } from "@/services/database";
import { getUserFromToken } from "@/services/auth";
import { recordActivity } from "@/services/community";
import { syncDefaultProfileLists } from "@/services/lists";

type Params = Promise<{ slug: string }>;

const MIN_COMMENT_LENGTH = 3;
const MAX_COMMENT_LENGTH = 1000;
const VALID_GAME_STATUSES = new Set(["released", "upcoming", "early_access"]);

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const serviceClient = createServiceDatabaseClient();
  const game = await getGameBySlug(serviceClient, slug);
  const userId = await getAuthenticatedUserId(request);

  if (!game) {
    return NextResponse.json({
      averageScore: 0,
      ratingCount: 0,
      userRating: null,
      comments: []
    });
  }

  const [commentsResult, userRatingResult] = await Promise.all([
    getVisibleCommunityComments(serviceClient, game.id),
    userId
      ? serviceClient
          .from("ratings")
          .select("score, comment_body")
          .eq("game_id", game.id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (commentsResult.error) {
    return NextResponse.json({ error: commentsResult.error.message }, { status: 500 });
  }

  if (userRatingResult.error) {
    return NextResponse.json({ error: userRatingResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    averageScore: Number(game.user_score ?? 0),
    ratingCount: Number(game.rating_count ?? 0),
    userRating: userRatingResult.data
      ? {
          score: Number(userRatingResult.data.score),
          comment: userRatingResult.data.comment_body ?? ""
        }
      : null,
    comments: (commentsResult.data ?? [])
      .filter((rating: any) => typeof rating.comment_body === "string" && rating.comment_body.trim())
      .map((rating: any) => {
        const profile = Array.isArray(rating.profiles) ? rating.profiles[0] : rating.profiles;

        return {
          id: rating.id,
          score: Number(rating.score),
          body: rating.comment_body,
          updatedAt: rating.updated_at,
          user: {
            username: profile?.username ?? "usuario",
            displayName: profile?.display_name ?? profile?.username ?? "Usuario",
            avatarUrl: profile?.avatar_url ?? null
          }
        };
      })
  });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión para valorar un juego." }, { status: 401 });
  }

  const user = await getUserFromToken(token);

  if (!user) {
    return NextResponse.json({ error: "La sesión no es válida o ha caducado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const score = Number(payload?.score);
  const comment = String(payload?.comment ?? "").trim();

  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return NextResponse.json({ error: "La puntuación debe estar entre 1 y 10." }, { status: 400 });
  }

  if (comment.length < MIN_COMMENT_LENGTH || comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `El comentario debe tener entre ${MIN_COMMENT_LENGTH} y ${MAX_COMMENT_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  const serviceClient = createServiceDatabaseClient();
  const [profileResult, gameResult] = await Promise.all([
    ensureProfile(serviceClient, user),
    ensureGame(serviceClient, slug, payload?.game)
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error }, { status: 500 });
  }

  if (gameResult.error || !gameResult.game) {
    return NextResponse.json({ error: gameResult.error ?? "No se pudo preparar el juego." }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: ratingError } = await serviceClient.from("ratings").upsert(
    {
      game_id: gameResult.game.id,
      user_id: user.id,
      score,
      comment_body: comment,
      updated_at: now
    },
    { onConflict: "game_id,user_id" }
  );

  if (ratingError) {
    return NextResponse.json({ error: ratingError.message }, { status: 500 });
  }

  const stats = await recalculateGameStats(serviceClient, gameResult.game.id);
  await recordActivity(serviceClient, {
    userId: user.id,
    gameId: gameResult.game.id,
    type: "rating",
    message: `valoró ${slug}`
  }).catch(() => null);
  await syncDefaultProfileLists(serviceClient, {
    id: user.id,
    username: user.user_metadata.username
  }).catch(() => null);

  if (stats.error) {
    return NextResponse.json({ error: stats.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    averageScore: stats.averageScore,
    ratingCount: stats.ratingCount
  });
}

async function getGameBySlug(serviceClient: ReturnType<typeof createServiceDatabaseClient>, slug: string) {
  const { data, error } = await serviceClient
    .from("games")
    .select("id, user_score, rating_count")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function ensureGame(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  slug: string,
  gamePayload: any
) {
  const existing = await getGameBySlug(serviceClient, slug);

  if (existing) {
    return { game: existing };
  }

  const title = String(gamePayload?.title ?? slug).trim() || slug;
  const status = VALID_GAME_STATUSES.has(gamePayload?.status) ? gamePayload.status : "released";
  const releaseYear = Number(gamePayload?.releaseYear);

  const { data, error } = await serviceClient
    .from("games")
    .insert({
      slug,
      title,
      summary: gamePayload?.summary ? String(gamePayload.summary) : null,
      release_year: Number.isInteger(releaseYear) && releaseYear > 0 ? releaseYear : null,
      status,
      cover_url: gamePayload?.coverUrl ? String(gamePayload.coverUrl) : null,
      hero_url: gamePayload?.heroUrl ? String(gamePayload.heroUrl) : null
    })
    .select("id, user_score, rating_count")
    .single();

  if (error) {
    return { game: null, error: error.message };
  }

  return { game: data };
}

async function ensureProfile(serviceClient: ReturnType<typeof createServiceDatabaseClient>, user: any) {
  const { data: existing, error: existingError } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  if (existing) {
    return { error: null };
  }

  const baseUsername = getSafeUsername(
    user.user_metadata?.username ?? user.email?.split("@")[0] ?? `user-${String(user.id).slice(0, 8)}`
  );
  const username = await getAvailableUsername(serviceClient, baseUsername, user.id);

  const { error } = await serviceClient.from("profiles").insert({
    id: user.id,
    username,
    display_name: user.user_metadata?.display_name ?? user.user_metadata?.username ?? username
  });

  return { error: error?.message ?? null };
}

async function getAvailableUsername(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  baseUsername: string,
  userId: string
) {
  const { data } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("username", baseUsername)
    .maybeSingle();

  if (!data || data.id === userId) {
    return baseUsername;
  }

  return `${baseUsername}-${String(userId).slice(0, 6)}`;
}

function getSafeUsername(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 32);

  return normalized || "usuario";
}

async function recalculateGameStats(serviceClient: ReturnType<typeof createServiceDatabaseClient>, gameId: string) {
  const { data, error } = await serviceClient.from("ratings").select("score").eq("game_id", gameId);

  if (error) {
    return { error: error.message };
  }

  const scores = (data ?? []).map((rating: any) => Number(rating.score)).filter((value: number) => Number.isFinite(value));
  const ratingCount = scores.length;
  const averageScore =
    ratingCount > 0
      ? Number((scores.reduce((total: number, value: number) => total + value, 0) / ratingCount).toFixed(1))
      : 0;

  const { error: updateError } = await serviceClient
    .from("games")
    .update({
      user_score: averageScore,
      rating_count: ratingCount,
      updated_at: new Date().toISOString()
    })
    .eq("id", gameId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { averageScore, ratingCount };
}

async function getAuthenticatedUserId(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  try {
    const user = await getUserFromToken(token);

    return user?.id ?? null;
  } catch {
    return null;
  }
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice("bearer ".length).trim();
}

async function getVisibleCommunityComments(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  gameId: string
) {
  const baseQuery = serviceClient
    .from("ratings")
    .select("id, score, comment_body, updated_at, profiles:user_id(username, display_name, avatar_url)")
    .eq("game_id", gameId)
    .not("comment_body", "is", null)
    .order("updated_at", { ascending: false });

  const visibleOnlyResult = await baseQuery.is("hidden_at", null);

  if (!isMissingHiddenAtColumnError(visibleOnlyResult.error?.message)) {
    return visibleOnlyResult;
  }

  return serviceClient
    .from("ratings")
    .select("id, score, comment_body, updated_at, profiles:user_id(username, display_name, avatar_url)")
    .eq("game_id", gameId)
    .not("comment_body", "is", null)
    .order("updated_at", { ascending: false });
}

function isMissingHiddenAtColumnError(message?: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes('column "hidden_at"') && normalized.includes("does not exist");
}








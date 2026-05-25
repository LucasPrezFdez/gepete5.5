import type { AuthUser } from "@/services/auth-types";
import type { Game, Profile, Review, UserGameStatus } from "@/data/games";
import { createServiceDatabaseClient } from "@/services/database";
import { getUserFromToken } from "@/services/auth";
import { slugify } from "@/lib/utils";

export const VALID_LIBRARY_STATUSES: UserGameStatus[] = [
  "want_to_play",
  "playing",
  "completed",
  "dropped",
  "paused",
  "favorite"
];

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice("bearer ".length).trim();
}

export async function getUserFromRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) return { user: null, token: null, error: "Debes iniciar sesión." };

  const user = await getUserFromToken(token);

  if (!user) return { user: null, token, error: "La sesión no es válida o ha caducado." };
  return { user, token, error: null };
}

export async function getOptionalUserIdFromRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  try {
    const user = await getUserFromToken(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function ensureProfile(serviceClient: ReturnType<typeof createServiceDatabaseClient>, user: AuthUser) {
  const { data: existing, error: existingError } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const baseUsername = getSafeUsername(
    user.user_metadata?.username ?? user.email?.split("@")[0] ?? `user-${String(user.id).slice(0, 8)}`
  );
  const username = await getAvailableUsername(serviceClient, baseUsername, user.id);

  const { error } = await serviceClient.from("profiles").insert({
    id: user.id,
    username,
    display_name: user.user_metadata?.display_name ?? user.user_metadata?.username ?? username
  });

  if (error) throw new Error(error.message);
}

export async function ensureGame(serviceClient: ReturnType<typeof createServiceDatabaseClient>, slug: string, game?: Partial<Game>) {
  const { data: existing, error: existingError } = await serviceClient
    .from("games")
    .select("id, slug, title, user_score, rating_count, review_count")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing;

  const title = String(game?.title ?? slug).trim() || slug;
  const { data, error } = await serviceClient
    .from("games")
    .insert({
      slug,
      title,
      summary: game?.summary ?? null,
      release_year: game?.year && game.year > 0 ? game.year : null,
      status: game?.status ?? "released",
      cover_url: game?.coverUrl ?? null,
      hero_url: game?.heroUrl ?? game?.coverUrl ?? null,
      user_score: game?.userScore ?? 0,
      critic_score: game?.criticScore ?? null,
      rating_count: game?.ratings ?? 0,
      review_count: game?.reviews ?? 0,
      popularity_score: (game?.ratings ?? 0) + (game?.reviews ?? 0) * 2
    })
    .select("id, slug, title, user_score, rating_count, review_count")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo preparar el juego.");
  return data;
}

export async function recalculateGameStats(serviceClient: ReturnType<typeof createServiceDatabaseClient>, gameId: string) {
  const [ratingsResult, reviewsResult] = await Promise.all([
    serviceClient.from("ratings").select("score").eq("game_id", gameId),
    serviceClient.from("reviews").select("id", { count: "exact", head: true }).eq("game_id", gameId)
  ]);

  if (ratingsResult.error) throw new Error(ratingsResult.error.message);
  if (reviewsResult.error) throw new Error(reviewsResult.error.message);

  const scores = (ratingsResult.data ?? []).map((rating: any) => Number(rating.score)).filter(Number.isFinite);
  const ratingCount = scores.length;
  const averageScore = ratingCount > 0 ? Number((scores.reduce((total: number, value: number) => total + value, 0) / ratingCount).toFixed(1)) : 0;
  const reviewCount = reviewsResult.count ?? 0;

  const { error } = await serviceClient
    .from("games")
    .update({
      user_score: averageScore,
      rating_count: ratingCount,
      review_count: reviewCount,
      popularity_score: ratingCount + reviewCount * 2,
      updated_at: new Date().toISOString()
    })
    .eq("id", gameId);

  if (error) throw new Error(error.message);
  return { averageScore, ratingCount, reviewCount };
}

export async function recordActivity(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  payload: {
    userId: string;
    type: "rating" | "review" | "list" | "status" | "favorite";
    message: string;
    gameId?: string | null;
    reviewId?: string | null;
    listId?: string | null;
  }
) {
  await serviceClient.from("activity_events").insert({
    user_id: payload.userId,
    type: payload.type,
    message: payload.message,
    game_id: payload.gameId ?? null,
    review_id: payload.reviewId ?? null,
    list_id: payload.listId ?? null
  });
}

export function profileFromRow(row: any, featuredGameSlug?: string | null): Profile {
  return {
    id: row.id,
    username: row.username ?? "usuario",
    displayName: row.display_name ?? row.username ?? "Usuario",
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    bannerUrl: row.banner_url ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    favoritePlatforms: Array.isArray(row.favorite_platforms) ? row.favorite_platforms.map(String) : [],
    favoriteGenres: Array.isArray(row.favorite_genres) ? row.favorite_genres.map(String) : [],
    featuredGameSlug: featuredGameSlug ?? null
  };
}

export function reviewFromRow(row: any): Review {
  const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const gameRow = Array.isArray(row.games) ? row.games[0] : row.games;
  return {
    id: row.id,
    gameSlug: gameRow?.slug ?? "",
    gameTitle: gameRow?.title,
    user: profileFromRow(profileRow ?? { id: row.user_id, username: "usuario" }),
    title: row.title,
    body: row.body,
    score: Number(row.score ?? 0),
    helpfulCount: Number(row.helpful_count ?? 0),
    hasSpoilers: Boolean(row.has_spoilers),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getAvailableUsername(
  serviceClient: ReturnType<typeof createServiceDatabaseClient>,
  baseUsername: string,
  userId: string
) {
  const { data } = await serviceClient.from("profiles").select("id").eq("username", baseUsername).maybeSingle();
  if (!data || data.id === userId) return baseUsername;
  return `${baseUsername}-${String(userId).slice(0, 6)}`;
}

function getSafeUsername(value: string) {
  return slugify(value).replace(/-/g, "_").slice(0, 32) || "usuario";
}





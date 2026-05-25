import { createHash, randomBytes, scryptSync } from "crypto";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";
import { FALLBACK_USERS, type MockUser } from "@/data/fallback-users";
import { FALLBACK_GAMES } from "@/data/fallback-games";
import type { GameList, Review } from "@/data/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/seed/fallback-users");

const SEED_NAMESPACE = "gameindex.fallback-users";
const LIST_NAMESPACE = "gameindex.fallback-lists";
const REVIEW_NAMESPACE = "gameindex.fallback-reviews";
const RATING_NAMESPACE = "gameindex.fallback-ratings";

export async function POST(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  try {
    const sql = createSqlClient();
    const stats = {
      users: { inserted: 0, updated: 0, failed: 0 },
      games: { inserted: 0, skipped: 0 },
      lists: { upserted: 0, items: 0 },
      reviews: { upserted: 0 },
      ratings: { upserted: 0 },
      errors: [] as string[]
    };

    // 1) Asegurar que todos los juegos referenciados existen en `games`
    const slugSet = new Set<string>();
    for (const user of FALLBACK_USERS) {
      if (user.profile.featuredGameSlug) slugSet.add(user.profile.featuredGameSlug);
      for (const list of user.lists) for (const item of list.items) slugSet.add(item.game.slug);
      for (const review of user.reviews) slugSet.add(review.gameSlug);
    }

    const existingGames = (await sql.query(
      "select id, slug from games where slug = any($1::text[])",
      [Array.from(slugSet)]
    )) as Array<{ id: string; slug: string }>;
    const gameIdBySlug = new Map(existingGames.map((g) => [g.slug, g.id]));

    const missing = Array.from(slugSet).filter((slug) => !gameIdBySlug.has(slug));
    if (missing.length) {
      const fallbackBySlug = new Map(FALLBACK_GAMES.map((game) => [game.slug, game]));
      for (const slug of missing) {
        const game = fallbackBySlug.get(slug);
        if (!game) {
          stats.games.skipped += 1;
          continue;
        }
        try {
          const rows = (await sql.query(
            `insert into games (slug, title, summary, release_year, status, cover_url, hero_url,
                                user_score, critic_score, rating_count, review_count, popularity_score,
                                last_synced_at, updated_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
             on conflict (slug) do update set
               title = excluded.title,
               summary = coalesce(excluded.summary, games.summary),
               cover_url = coalesce(excluded.cover_url, games.cover_url),
               hero_url = coalesce(excluded.hero_url, games.hero_url),
               updated_at = now()
             returning id`,
            [
              game.slug,
              game.title,
              game.summary ?? null,
              game.year > 0 ? game.year : null,
              game.status ?? "released",
              game.coverUrl ?? null,
              game.heroUrl ?? game.coverUrl ?? null,
              game.userScore ?? 0,
              game.criticScore ?? null,
              game.ratings ?? 0,
              game.reviews ?? 0,
              (game.ratings ?? 0) + (game.reviews ?? 0) * 2
            ]
          )) as Array<{ id: string }>;
          gameIdBySlug.set(slug, rows[0].id);
          stats.games.inserted += 1;
        } catch (error) {
          stats.errors.push(`game/${slug}: ${error instanceof Error ? error.message : String(error)}`);
          stats.games.skipped += 1;
        }
      }
    }

    // 2) Por cada usuario: cuenta + profile + listas + items + reviews + ratings
    for (const mock of FALLBACK_USERS) {
      try {
        const userId = await upsertUser(sql, mock);
        if (userId.created) stats.users.inserted += 1;
        else stats.users.updated += 1;

        for (const list of mock.lists) {
          try {
            const listId = await upsertList(sql, userId.id, list);
            stats.lists.upserted += 1;
            stats.lists.items += await upsertListItems(sql, listId, list, gameIdBySlug);
          } catch (error) {
            stats.errors.push(
              `list/${mock.profile.username}/${list.slug}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        for (const review of mock.reviews) {
          const gameId = gameIdBySlug.get(review.gameSlug);
          if (!gameId) continue;
          try {
            await upsertReview(sql, userId.id, gameId, review);
            stats.reviews.upserted += 1;
            await upsertRating(sql, userId.id, gameId, review);
            stats.ratings.upserted += 1;
          } catch (error) {
            stats.errors.push(
              `review/${mock.profile.username}/${review.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      } catch (error) {
        stats.users.failed += 1;
        stats.errors.push(`user/${mock.profile.username}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    log.info("fallback content seeded", { adminId: auth.user!.id, ...stats });
    return jsonOk({ ok: true, stats, totalUsers: FALLBACK_USERS.length });
  } catch (error) {
    log.error("seed failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudo ejecutar el seed.", 500);
  }
}

async function upsertUser(sql: ReturnType<typeof createSqlClient>, mock: MockUser) {
  const id = deriveUuid(`${SEED_NAMESPACE}:${mock.profile.username}`);
  const email = `${mock.profile.username}@mock.gameindex.local`;
  const passwordHash = hashPassword(randomBytes(16).toString("hex"));

  const existingByUsername = (await sql.query(
    "select id from app_users where username = $1 limit 1",
    [mock.profile.username]
  )) as Array<{ id: string }>;
  const existingByEmail = (await sql.query(
    "select id from app_users where email = $1 limit 1",
    [email]
  )) as Array<{ id: string }>;
  const targetId = existingByUsername[0]?.id ?? existingByEmail[0]?.id ?? id;
  const created = !existingByUsername.length && !existingByEmail.length;

  await sql.query(
    `insert into app_users (id, email, password_hash, username, display_name, created_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set display_name = excluded.display_name, updated_at = now()`,
    [
      targetId,
      email,
      passwordHash,
      mock.profile.username,
      mock.profile.displayName ?? mock.profile.username,
      mock.profile.createdAt ?? new Date().toISOString()
    ]
  );

  await sql.query(
    `insert into profiles (id, username, display_name, bio, avatar_url, banner_url,
                           favorite_platforms, favorite_genres, created_at, updated_at,
                           onboarding_completed)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
     on conflict (id) do update set
       username = excluded.username,
       display_name = excluded.display_name,
       bio = excluded.bio,
       avatar_url = excluded.avatar_url,
       banner_url = excluded.banner_url,
       favorite_platforms = excluded.favorite_platforms,
       favorite_genres = excluded.favorite_genres,
       updated_at = excluded.updated_at,
       onboarding_completed = true`,
    [
      targetId,
      mock.profile.username,
      mock.profile.displayName ?? mock.profile.username,
      mock.profile.bio ?? null,
      mock.profile.avatarUrl ?? null,
      mock.profile.bannerUrl ?? null,
      mock.profile.favoritePlatforms ?? [],
      mock.profile.favoriteGenres ?? [],
      mock.profile.createdAt ?? new Date().toISOString(),
      mock.profile.updatedAt ?? new Date().toISOString()
    ]
  );

  return { id: targetId, created };
}

async function upsertList(
  sql: ReturnType<typeof createSqlClient>,
  userId: string,
  list: GameList
): Promise<string> {
  const listId = deriveUuid(`${LIST_NAMESPACE}:${list.slug}`);

  // Slug puede colisionar (UNIQUE en `lists.slug`). Si existe con otro user_id, hacemos no-op a nivel slug
  // pero dejamos al usuario sin esa lista. Estrategia: cuando hay colisión, prefijamos con username.
  const existing = (await sql.query("select id, user_id from lists where slug = $1 limit 1", [list.slug])) as Array<{
    id: string;
    user_id: string;
  }>;
  if (existing.length && existing[0].user_id !== userId) {
    const prefixedSlug = `${list.slug}-${userId.slice(0, 6)}`;
    const rows = (await sql.query(
      `insert into lists (id, user_id, slug, title, description, cover_url, is_public, likes_count, created_at)
       values ($1, $2, $3, $4, $5, $6, true, $7, $8)
       on conflict (id) do update set
         title = excluded.title,
         description = excluded.description,
         cover_url = excluded.cover_url,
         likes_count = excluded.likes_count
       returning id`,
      [
        listId,
        userId,
        prefixedSlug,
        list.title,
        list.description ?? null,
        list.coverUrl ?? null,
        list.likesCount ?? 0,
        list.createdAt ?? new Date().toISOString()
      ]
    )) as Array<{ id: string }>;
    return rows[0].id;
  }

  const rows = (await sql.query(
    `insert into lists (id, user_id, slug, title, description, cover_url, is_public, likes_count, created_at)
     values ($1, $2, $3, $4, $5, $6, true, $7, $8)
     on conflict (id) do update set
       title = excluded.title,
       description = excluded.description,
       cover_url = excluded.cover_url,
       likes_count = excluded.likes_count
     returning id`,
    [
      listId,
      userId,
      list.slug,
      list.title,
      list.description ?? null,
      list.coverUrl ?? null,
      list.likesCount ?? 0,
      list.createdAt ?? new Date().toISOString()
    ]
  )) as Array<{ id: string }>;
  return rows[0].id;
}

async function upsertListItems(
  sql: ReturnType<typeof createSqlClient>,
  listId: string,
  list: GameList,
  gameIdBySlug: Map<string, string>
): Promise<number> {
  let inserted = 0;
  for (const item of list.items) {
    const gameId = gameIdBySlug.get(item.game.slug);
    if (!gameId) continue;
    await sql.query(
      `insert into list_items (list_id, game_id, position, note)
       values ($1, $2, $3, $4)
       on conflict (list_id, game_id) do update set position = excluded.position, note = excluded.note`,
      [listId, gameId, item.position, item.note ?? null]
    );
    inserted += 1;
  }
  return inserted;
}

async function upsertReview(
  sql: ReturnType<typeof createSqlClient>,
  userId: string,
  gameId: string,
  review: Review
) {
  const reviewId = deriveUuid(`${REVIEW_NAMESPACE}:${review.id}`);
  // El schema exige int 1..10 — redondeamos
  const score = clampScore(review.score);
  await sql.query(
    `insert into reviews (id, game_id, user_id, title, body, score, has_spoilers, helpful_count, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (id) do update set
       title = excluded.title,
       body = excluded.body,
       score = excluded.score,
       has_spoilers = excluded.has_spoilers,
       helpful_count = excluded.helpful_count,
       updated_at = excluded.updated_at`,
    [
      reviewId,
      gameId,
      userId,
      review.title,
      review.body,
      score,
      review.hasSpoilers ?? false,
      review.helpfulCount ?? 0,
      review.createdAt ?? new Date().toISOString(),
      review.updatedAt ?? new Date().toISOString()
    ]
  );
}

async function upsertRating(
  sql: ReturnType<typeof createSqlClient>,
  userId: string,
  gameId: string,
  review: Review
) {
  const ratingId = deriveUuid(`${RATING_NAMESPACE}:${userId}:${gameId}`);
  const score = clampScore(review.score);
  // `ratings` tiene UNIQUE (game_id, user_id)
  await sql.query(
    `insert into ratings (id, game_id, user_id, score, comment_body, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (game_id, user_id) do update set
       score = excluded.score,
       updated_at = excluded.updated_at`,
    [
      ratingId,
      gameId,
      userId,
      score,
      null,
      review.createdAt ?? new Date().toISOString(),
      review.updatedAt ?? new Date().toISOString()
    ]
  );
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 5;
  return Math.max(1, Math.min(10, Math.round(score)));
}

function deriveUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32)
  ].join("-");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

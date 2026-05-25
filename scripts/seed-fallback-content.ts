// Seed completo: usuarios + juegos + listas + reviews + ratings de fallback-users.ts.
// Ejecutar con:  npx tsx scripts/seed-fallback-content.ts
//
// Idempotente: usa UUIDs derivados de los identificadores del mock + ON CONFLICT.

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { FALLBACK_USERS, type MockUser } from "../data/fallback-users";
import { FALLBACK_GAMES } from "../data/fallback-games";
import type { GameList, Review } from "../data/games";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_NAMESPACE = "gameindex.fallback-users";
const LIST_NAMESPACE = "gameindex.fallback-lists";
const REVIEW_NAMESPACE = "gameindex.fallback-reviews";
const RATING_NAMESPACE = "gameindex.fallback-ratings";

async function loadEnv() {
  try {
    const raw = (await readFile(resolve(REPO, ".env"), "utf8")).replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
      if (!m) continue;
      if (process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* opcional */
  }
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

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 5;
  return Math.max(1, Math.min(10, Math.round(score)));
}

async function main() {
  await loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL en .env.");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  // --- 1. Recoger slugs únicos referenciados ---
  const slugs = new Set<string>();
  for (const user of FALLBACK_USERS) {
    if (user.profile.featuredGameSlug) slugs.add(user.profile.featuredGameSlug);
    for (const list of user.lists) for (const item of list.items) slugs.add(item.game.slug);
    for (const review of user.reviews) slugs.add(review.gameSlug);
  }
  console.log(`Slugs referenciados: ${slugs.size}`);

  // --- 2. Asegurar juegos en DB ---
  const existing = (await sql.query("select id, slug from games where slug = any($1::text[])", [
    Array.from(slugs)
  ])) as Array<{ id: string; slug: string }>;
  const gameIdBySlug = new Map(existing.map((row) => [row.slug, row.id]));
  const missing = Array.from(slugs).filter((slug) => !gameIdBySlug.has(slug));
  console.log(`Juegos ya en DB: ${gameIdBySlug.size}, a insertar: ${missing.length}`);

  const fallbackBySlug = new Map(FALLBACK_GAMES.map((game) => [game.slug, game]));
  let inserted = 0;
  let skipped = 0;
  for (const slug of missing) {
    const game = fallbackBySlug.get(slug);
    if (!game) {
      skipped += 1;
      continue;
    }
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
    inserted += 1;
  }
  console.log(`Juegos insertados: ${inserted}, sin definición fallback: ${skipped}`);

  // --- 3. Por cada usuario ---
  const counters = { users: 0, lists: 0, items: 0, reviews: 0, ratings: 0, errors: 0 };
  for (const mock of FALLBACK_USERS) {
    try {
      const userId = await upsertUser(sql, mock);
      counters.users += 1;

      for (const list of mock.lists) {
        try {
          const listId = await upsertList(sql, userId, list);
          counters.lists += 1;
          counters.items += await upsertListItems(sql, listId, list, gameIdBySlug);
        } catch (error) {
          counters.errors += 1;
          console.error(`  ! list ${list.slug}: ${(error as Error).message}`);
        }
      }

      for (const review of mock.reviews) {
        const gameId = gameIdBySlug.get(review.gameSlug);
        if (!gameId) continue;
        try {
          await upsertReview(sql, userId, gameId, review);
          counters.reviews += 1;
          await upsertRating(sql, userId, gameId, review);
          counters.ratings += 1;
        } catch (error) {
          counters.errors += 1;
          console.error(`  ! review ${review.id}: ${(error as Error).message}`);
        }
      }

      console.log(`  ✓ @${mock.profile.username}`);
    } catch (error) {
      counters.errors += 1;
      console.error(`  ✗ @${mock.profile.username}: ${(error as Error).message}`);
    }
  }

  console.log(
    `\nResumen:
  Usuarios procesados: ${counters.users}
  Listas:              ${counters.lists}
  Items en listas:     ${counters.items}
  Reviews:             ${counters.reviews}
  Ratings:             ${counters.ratings}
  Errores:             ${counters.errors}`
  );
}

async function upsertUser(sql: ReturnType<typeof neon>, mock: MockUser) {
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
                           favorite_platforms, favorite_genres, created_at, updated_at, onboarding_completed)
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

  return targetId;
}

async function upsertList(sql: ReturnType<typeof neon>, userId: string, list: GameList): Promise<string> {
  const listId = deriveUuid(`${LIST_NAMESPACE}:${list.slug}`);
  const existing = (await sql.query("select id, user_id from lists where slug = $1 limit 1", [list.slug])) as Array<{
    id: string;
    user_id: string;
  }>;
  const targetSlug =
    existing.length && existing[0].user_id !== userId ? `${list.slug}-${userId.slice(0, 6)}` : list.slug;
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
      targetSlug,
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
  sql: ReturnType<typeof neon>,
  listId: string,
  list: GameList,
  gameIdBySlug: Map<string, string>
): Promise<number> {
  let count = 0;
  for (const item of list.items) {
    const gameId = gameIdBySlug.get(item.game.slug);
    if (!gameId) continue;
    await sql.query(
      `insert into list_items (list_id, game_id, position, note)
       values ($1, $2, $3, $4)
       on conflict (list_id, game_id) do update set position = excluded.position, note = excluded.note`,
      [listId, gameId, item.position, item.note ?? null]
    );
    count += 1;
  }
  return count;
}

async function upsertReview(
  sql: ReturnType<typeof neon>,
  userId: string,
  gameId: string,
  review: Review
) {
  const reviewId = deriveUuid(`${REVIEW_NAMESPACE}:${review.id}`);
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
  sql: ReturnType<typeof neon>,
  userId: string,
  gameId: string,
  review: Review
) {
  const ratingId = deriveUuid(`${RATING_NAMESPACE}:${userId}:${gameId}`);
  const score = clampScore(review.score);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

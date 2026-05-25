// One-shot seed: extrae los 50 perfiles de data/fallback-users.ts y los siembra
// en app_users + profiles. Idempotente por username (usa UUID derivado).
//
// Uso: node scripts/seed-fallback-users.mjs

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_NAMESPACE = "gameindex.fallback-users";

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
    // .env optional
  }
}

function parseProfiles(source) {
  const re = /const\s+profile:\s*Profile\s*=\s*({[\s\S]*?});/g;
  const profiles = [];
  let match;
  while ((match = re.exec(source))) {
    const block = match[1];
    const str = (key) => {
      const r = new RegExp(key + ':\\s*"([^"]*)"', "s");
      const m = r.exec(block);
      return m ? m[1] : null;
    };
    const arr = (key) => {
      const r = new RegExp(key + ":\\s*\\[([\\s\\S]*?)\\]", "s");
      const m = r.exec(block);
      if (!m) return [];
      return m[1]
        .split(",")
        .map((value) => value.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    };

    const username = str("username");
    if (!username) continue;

    profiles.push({
      username,
      displayName: str("displayName") ?? username,
      bio: str("bio"),
      avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
      bannerUrl: str("bannerUrl"),
      createdAt: str("createdAt") ?? new Date().toISOString(),
      updatedAt: str("updatedAt") ?? new Date().toISOString(),
      favoritePlatforms: arr("favoritePlatforms"),
      favoriteGenres: arr("favoriteGenres")
    });
  }
  return profiles;
}

function deriveUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32)
  ].join("-");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  await loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL en .env.");
    process.exit(1);
  }

  const source = await readFile(resolve(REPO, "data/fallback-users.ts"), "utf8");
  const profiles = parseProfiles(source);
  console.log(`Encontrados ${profiles.length} usuarios mock en fallback-users.ts.`);

  const sql = neon(process.env.DATABASE_URL);
  const stats = { inserted: 0, updated: 0, failed: 0 };

  for (const profile of profiles) {
    try {
      const id = deriveUuid(`${SEED_NAMESPACE}:${profile.username}`);
      const email = `${profile.username}@mock.gameindex.local`;
      const passwordHash = hashPassword(randomBytes(16).toString("hex"));

      const existingByUsername = await sql.query(
        "select id from app_users where username = $1 limit 1",
        [profile.username]
      );
      const existingByEmail = await sql.query(
        "select id from app_users where email = $1 limit 1",
        [email]
      );
      const targetId = existingByUsername[0]?.id ?? existingByEmail[0]?.id ?? id;
      const isNew = !existingByUsername.length && !existingByEmail.length;

      await sql.query(
        `insert into app_users (id, email, password_hash, username, display_name, created_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set
           display_name = excluded.display_name,
           updated_at = now()`,
        [targetId, email, passwordHash, profile.username, profile.displayName, profile.createdAt]
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
          profile.username,
          profile.displayName,
          profile.bio,
          profile.avatarUrl,
          profile.bannerUrl,
          profile.favoritePlatforms,
          profile.favoriteGenres,
          profile.createdAt,
          profile.updatedAt
        ]
      );

      if (isNew) stats.inserted += 1;
      else stats.updated += 1;
      console.log(`  ${isNew ? "+" : "~"} @${profile.username}`);
    } catch (error) {
      stats.failed += 1;
      console.error(`  ✗ @${profile.username}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(
    `\nResultado: ${stats.inserted} nuevos · ${stats.updated} actualizados · ${stats.failed} con error`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

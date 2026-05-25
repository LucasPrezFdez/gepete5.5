import { createHash, scryptSync, randomBytes } from "crypto";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";
import { FALLBACK_USERS } from "@/data/fallback-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/seed/fallback-users");

const SEED_NAMESPACE = "gameindex.fallback-users";

export async function POST(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  try {
    const sql = createSqlClient();
    const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

    for (const mock of FALLBACK_USERS) {
      try {
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
        const isNew = !existingByUsername.length && !existingByEmail.length;

        await sql.query(
          `insert into app_users (id, email, password_hash, username, display_name, created_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update set
             display_name = excluded.display_name,
             updated_at = now()`,
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

        if (isNew) result.inserted += 1;
        else result.updated += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.warn("seed user failed", { username: mock.profile.username, error: message });
        result.errors.push(`${mock.profile.username}: ${message}`);
        result.skipped += 1;
      }
    }

    log.info("fallback users seeded", { adminId: auth.user!.id, ...result });
    return jsonOk({ ok: true, ...result, total: FALLBACK_USERS.length });
  } catch (error) {
    log.error("seed failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudo ejecutar el seed.", 500);
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

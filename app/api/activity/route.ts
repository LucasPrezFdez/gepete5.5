import { createServiceDatabaseClient } from "@/services/database";
import { jsonError, jsonOk, publicCacheHeaders } from "@/lib/api";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/activity");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username") ?? undefined;
  const limit = clampLimit(searchParams.get("limit"));

  try {
    const serviceClient = createServiceDatabaseClient();
    let query = serviceClient
      .from("activity_events")
      .select(
        "id,type,message,created_at, games:game_id(slug,title,cover_url), lists:list_id(slug,title), profiles:user_id(username,display_name,avatar_url)"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (username) query = query.eq("profiles.username", username);

    const { data, error } = await query;
    if (error) {
      log.error("activity query failed", { reason: error.message });
      return jsonError(error.message, 500);
    }

    const events = (data ?? [])
      .filter((row: any) => row.profiles)
      .map((row: any) => ({
        id: row.id,
        type: row.type,
        message: row.message,
        createdAt: row.created_at,
        user: row.profiles
          ? {
              username: row.profiles.username,
              displayName: row.profiles.display_name ?? row.profiles.username,
              avatarUrl: row.profiles.avatar_url ?? null
            }
          : null,
        game: row.games ?? null,
        list: row.lists ?? null
      }));

    return jsonOk(
      { events },
      { headers: publicCacheHeaders({ sMaxAge: 15, swr: 120 }) }
    );
  } catch (error) {
    log.error("activity failed", { error });
    return jsonError("No se pudo cargar la actividad.", 500);
  }
}

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}

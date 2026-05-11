import { getExploreGames } from "@/services/games";
import type { GameSort } from "@/data/games";
import { jsonError, jsonOk, publicCacheHeaders } from "@/lib/api";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/games");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const result = await getExploreGames({
      query: searchParams.get("q") ?? searchParams.get("search") ?? undefined,
      page: getPositiveInteger(searchParams.get("page"), 1),
      pageSize: clampPageSize(searchParams.get("pageSize"), 24),
      platform: searchParams.get("platform") ?? undefined,
      genre: searchParams.get("genre") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      year: getOptionalInteger(searchParams.get("year")),
      scoreMin: getOptionalInteger(searchParams.get("scoreMin")),
      sort: getSort(searchParams.get("sort"))
    });

    return jsonOk(result as unknown as Record<string, unknown>, {
      headers: publicCacheHeaders({ sMaxAge: 60, swr: 600 })
    });
  } catch (error) {
    log.error("getExploreGames failed", { error });
    return jsonError("No se pudieron cargar los juegos.", 500);
  }
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

function getOptionalInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function getSort(value: string | null): GameSort | undefined {
  return value === "popular" || value === "score" || value === "recent" || value === "upcoming" || value === "reviewed"
    ? value
    : undefined;
}

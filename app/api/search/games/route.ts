import { fromSearchDocument, searchGames } from "@/services/search";
import { getExploreGames } from "@/services/games";
import type { GameSort } from "@/data/games";
import { jsonError, jsonOk, publicCacheHeaders } from "@/lib/api";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/search/games");

const VALID_SORTS: GameSort[] = ["popular", "score", "recent", "upcoming", "reviewed"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();
  const page = clampPositive(searchParams.get("page"), 1, 1, 1000);
  const pageSize = clampPositive(searchParams.get("pageSize"), 12, 1, 50);
  const platform = searchParams.get("platform") ?? undefined;
  const genre = searchParams.get("genre") ?? undefined;
  const year = parseOptionalInt(searchParams.get("year"));
  const status = searchParams.get("status") ?? undefined;
  const scoreMin = parseOptionalInt(searchParams.get("scoreMin"));
  const sort = parseSort(searchParams.get("sort"));

  if (process.env.MEILISEARCH_HOST && process.env.MEILISEARCH_API_KEY !== undefined) {
    try {
      const result = await searchGames({ query, platform, genre, year, status, scoreMin, sort, page, pageSize });
      return jsonOk(
        {
          source: "meili",
          query,
          page,
          pageSize,
          count: result.estimatedTotalHits,
          games: result.hits.map(fromSearchDocument),
          facets: result.facetDistribution ?? null
        },
        { headers: publicCacheHeaders({ sMaxAge: 30, swr: 300 }) }
      );
    } catch (error) {
      log.warn("meilisearch failed, falling back", { error });
    }
  }

  try {
    const result = await getExploreGames({ query, platform, genre, year, status, scoreMin, sort, page, pageSize });
    return jsonOk(
      {
        source: result.source,
        query: result.query ?? query,
        page: result.page,
        pageSize: result.pageSize,
        count: result.count,
        games: result.games,
        facets: result.facets ?? null,
        ...(result.error ? { warning: result.error } : {})
      },
      { headers: publicCacheHeaders({ sMaxAge: 30, swr: 300 }) }
    );
  } catch (error) {
    log.error("search fallback failed", { error });
    return jsonError("No se pudo completar la búsqueda.", 500);
  }
}

function clampPositive(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function parseOptionalInt(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function parseSort(value: string | null): GameSort | undefined {
  return VALID_SORTS.find((sort) => sort === value);
}

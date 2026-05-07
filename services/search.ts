import MeiliSearch from "meilisearch";
import type { Game, GameSort } from "@/data/games";

export type GameSearchDocument = {
  id: string;
  slug: string;
  title: string;
  year: number;
  platforms: string[];
  genres: string[];
  developer: string;
  publisher: string;
  status: string;
  userScore: number;
  criticScore: number | null;
  ratingCount: number;
  reviewCount: number;
  popularityScore: number;
  coverUrl: string;
  heroUrl: string;
  summary: string;
  releaseDate: string;
};

export type GameSearchParams = {
  query?: string;
  platform?: string;
  genre?: string;
  year?: number;
  status?: string;
  scoreMin?: number;
  sort?: GameSort;
  page?: number;
  pageSize?: number;
};

export type SearchGamesResult = {
  hits: GameSearchDocument[];
  estimatedTotalHits: number;
  facetDistribution?: Record<string, Record<string, number>>;
};

export function getMeiliClient() {
  return new MeiliSearch({
    host: process.env.MEILISEARCH_HOST ?? "http://127.0.0.1:7700",
    apiKey: process.env.MEILISEARCH_API_KEY
  });
}

export function toSearchDocument(game: Game): GameSearchDocument {
  return {
    id: game.slug,
    slug: game.slug,
    title: game.title,
    year: game.year,
    platforms: game.platforms,
    genres: game.genres,
    developer: game.developer,
    publisher: game.publisher,
    status: game.status,
    userScore: game.userScore,
    criticScore: game.criticScore,
    ratingCount: game.ratings,
    reviewCount: game.reviews,
    popularityScore: game.ratings + game.reviews * 2,
    coverUrl: game.coverUrl,
    heroUrl: game.heroUrl,
    summary: game.summary,
    releaseDate: game.releaseDate
  };
}

export function fromSearchDocument(document: GameSearchDocument): Game {
  return {
    title: document.title,
    slug: document.slug,
    year: document.year,
    platforms: document.platforms ?? [],
    genres: document.genres ?? [],
    developer: document.developer,
    publisher: document.publisher,
    userScore: Number(document.userScore ?? 0),
    criticScore: document.criticScore,
    reviews: Number(document.reviewCount ?? 0),
    ratings: Number(document.ratingCount ?? 0),
    status: document.status === "upcoming" || document.status === "early_access" ? document.status : "released",
    coverUrl: document.coverUrl,
    heroUrl: document.heroUrl,
    summary: document.summary,
    modes: ["Información no disponible"],
    releaseDate: document.releaseDate
  };
}

export async function ensureGamesIndex() {
  const client = getMeiliClient();
  const index = client.index<GameSearchDocument>("games");

  await Promise.allSettled([
    index.updateFilterableAttributes(["platforms", "genres", "year", "status", "userScore"]),
    index.updateSortableAttributes(["popularityScore", "userScore", "year", "ratingCount", "reviewCount"]),
    index.updateSearchableAttributes(["title", "developer", "publisher", "genres", "platforms", "summary"])
  ]);

  return index;
}

export async function indexGame(game: Game) {
  const index = await ensureGamesIndex();
  return index.addDocuments([toSearchDocument(game)], { primaryKey: "id" });
}

export async function indexGames(games: Game[]) {
  if (games.length === 0) return null;
  const index = await ensureGamesIndex();
  return index.addDocuments(games.map(toSearchDocument), { primaryKey: "id" });
}

function quoteFilterValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function getSort(sort?: GameSort) {
  switch (sort) {
    case "score":
      return ["userScore:desc", "ratingCount:desc"];
    case "recent":
      return ["year:desc"];
    case "upcoming":
      return ["year:asc"];
    case "reviewed":
      return ["reviewCount:desc", "ratingCount:desc"];
    case "popular":
    default:
      return ["popularityScore:desc", "ratingCount:desc"];
  }
}

export async function searchGames(params: GameSearchParams): Promise<SearchGamesResult> {
  const index = await ensureGamesIndex();
  const filters = [
    params.platform ? `platforms = "${quoteFilterValue(params.platform)}"` : undefined,
    params.genre ? `genres = "${quoteFilterValue(params.genre)}"` : undefined,
    params.year ? `year = ${params.year}` : undefined,
    params.status ? `status = "${quoteFilterValue(params.status)}"` : undefined,
    params.scoreMin ? `userScore >= ${params.scoreMin}` : undefined
  ].filter(Boolean) as string[];
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(params.pageSize) || 24)));

  const result = await index.search(params.query ?? "", {
    filter: filters,
    facets: ["platforms", "genres", "year", "status"],
    sort: getSort(params.sort),
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  return {
    hits: result.hits as GameSearchDocument[],
    estimatedTotalHits: result.estimatedTotalHits ?? result.hits.length,
    facetDistribution: result.facetDistribution as Record<string, Record<string, number>> | undefined
  };
}

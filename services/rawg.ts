import { NormalizedExternalGame } from "@/services/igdb";
import { slugify } from "@/lib/utils";

const RAWG_API_BASE_URL = "https://api.rawg.io/api";
export const RAWG_PAGE_SIZE = 24;
const RAWG_MAX_PAGE_SIZE = 40;

export type RawgGameListItem = {
  id?: number;
  slug?: string;
  name?: string;
  released?: string | null;
  tba?: boolean;
  background_image?: string | null;
  rating?: number | null;
  ratings_count?: number;
  reviews_count?: number;
  metacritic?: number | null;
  platforms?: Array<{ platform?: { id?: number; name?: string; slug?: string } }>;
  genres?: Array<{ id?: number; name?: string; slug?: string }>;
};

export type RawgGameDetail = RawgGameListItem & {
  description_raw?: string | null;
  developers?: Array<{ id?: number; name?: string; slug?: string }>;
  publishers?: Array<{ id?: number; name?: string; slug?: string }>;
};

type RawgListResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type RawgGamesQuery = {
  query?: string;
  page?: number;
  pageSize?: number;
  ordering?: string;
  dates?: string;
};

export type RawgGamesResult = {
  provider: "rawg";
  query?: string;
  page: number;
  pageSize: number;
  count: number;
  nextPage: number | null;
  previousPage: number | null;
  results: RawgGameListItem[];
};

export class RawgApiError extends Error {
  constructor(
    message: string,
    public readonly code: "missing-key" | "request-failed" | "invalid-response"
  ) {
    super(message);
    this.name = "RawgApiError";
  }
}

function getRawgApiKey() {
  return process.env.RAWG_API_KEY?.trim() ?? "";
}

function clampPositiveInteger(value: number | undefined, fallback: number, max?: number) {
  const parsed = Number.isFinite(value) ? Math.floor(Number(value)) : fallback;
  const positive = Math.max(1, parsed);
  return max ? Math.min(max, positive) : positive;
}

function getPageFromUrl(url: string | null) {
  if (!url) return null;

  try {
    const page = Number(new URL(url).searchParams.get("page"));
    return Number.isFinite(page) && page > 0 ? page : null;
  } catch {
    return null;
  }
}

async function fetchRawg<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
) {
  const key = getRawgApiKey();

  if (!key) {
    throw new RawgApiError("Falta RAWG_API_KEY en .env.", "missing-key");
  }

  const url = new URL(`${RAWG_API_BASE_URL}${path}`);
  url.searchParams.set("key", key);

  Object.entries(params).forEach(([paramKey, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(paramKey, String(value));
    }
  });

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 }
  });

  if (!response.ok) {
    throw new RawgApiError(
      `RAWG respondió con estado ${response.status}.`,
      "request-failed"
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new RawgApiError("RAWG devolvió una respuesta inválida.", "invalid-response");
  }
}

export async function listRawgGames({
  query,
  page = 1,
  pageSize = RAWG_PAGE_SIZE,
  ordering = "-added",
  dates
}: RawgGamesQuery = {}): Promise<RawgGamesResult> {
  const safePage = clampPositiveInteger(page, 1);
  const safePageSize = clampPositiveInteger(pageSize, RAWG_PAGE_SIZE, RAWG_MAX_PAGE_SIZE);
  const normalizedQuery = query?.trim();

  const data = await fetchRawg<RawgListResponse<RawgGameListItem>>("/games", {
    page: safePage,
    page_size: safePageSize,
    ordering,
    dates,
    search: normalizedQuery || undefined
  });

  return {
    provider: "rawg",
    query: normalizedQuery || undefined,
    page: safePage,
    pageSize: safePageSize,
    count: data.count,
    nextPage: getPageFromUrl(data.next) ?? (data.next ? safePage + 1 : null),
    previousPage:
      getPageFromUrl(data.previous) ?? (data.previous ? Math.max(1, safePage - 1) : null),
    results: data.results ?? []
  };
}

export async function searchRawgGames(query: string, page = 1, pageSize = RAWG_PAGE_SIZE) {
  return listRawgGames({ query, page, pageSize });
}

export async function getRawgGameById(id: string) {
  return fetchRawg<RawgGameDetail>(`/games/${encodeURIComponent(id)}`);
}

export function normalizeRawgGame(rawGame: RawgGameListItem | RawgGameDetail): NormalizedExternalGame {
  const title = rawGame.name ?? "Juego sin título";
  const releaseDate = rawGame.released ?? undefined;

  return {
    externalId: String(rawGame.id ?? slugify(title)),
    provider: "rawg",
    slug: rawGame.slug ?? slugify(title),
    title,
    summary: "description_raw" in rawGame ? rawGame.description_raw ?? undefined : undefined,
    releaseYear: releaseDate ? new Date(releaseDate).getFullYear() : undefined,
    releaseDate,
    coverUrl: rawGame.background_image ?? undefined,
    platforms:
      rawGame.platforms
        ?.map((item) => item.platform?.name ?? "")
        .filter(Boolean) ?? [],
    genres: rawGame.genres?.map((genre) => genre.name ?? "").filter(Boolean) ?? [],
    developer:
      "developers" in rawGame
        ? rawGame.developers?.map((developer) => developer.name ?? "").filter(Boolean).join(", ")
        : undefined,
    publisher:
      "publishers" in rawGame
        ? rawGame.publishers?.map((publisher) => publisher.name ?? "").filter(Boolean).join(", ")
        : undefined,
    rating: rawGame.rating ?? undefined,
    ratingsCount: rawGame.ratings_count,
    reviewsCount: rawGame.reviews_count,
    metacritic: rawGame.metacritic ?? null
  };
}


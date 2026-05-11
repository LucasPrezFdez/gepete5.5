import { slugify } from "@/lib/utils";
import type { GameSort } from "@/data/games";

const IGDB_API_BASE_URL = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
export const IGDB_PAGE_SIZE = 24;
const IGDB_MAX_PAGE_SIZE = 50;

export type NormalizedExternalGame = {
  externalId: string;
  provider: "igdb" | "rawg";
  slug: string;
  title: string;
  summary?: string;
  releaseYear?: number;
  releaseDate?: string;
  coverUrl?: string;
  platforms: string[];
  genres: string[];
  developer?: string;
  publisher?: string;
  rating?: number;
  ratingsCount?: number;
  reviewsCount?: number;
  metacritic?: number | null;
};

type IgdbImage = {
  id?: number;
  url?: string;
};

type IgdbCompany = {
  name?: string;
};

type IgdbInvolvedCompany = {
  developer?: boolean;
  publisher?: boolean;
  company?: IgdbCompany;
};

type IgdbGameType = {
  id?: number;
  type?: string;
};

export type IgdbGame = {
  id?: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  cover?: IgdbImage;
  platforms?: Array<{ name?: string }>;
  genres?: Array<{ name?: string }>;
  involved_companies?: IgdbInvolvedCompany[];
  rating?: number;
  total_rating?: number;
  rating_count?: number;
  total_rating_count?: number;
  aggregated_rating?: number;
  game_type?: IgdbGameType;
};

type IgdbTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

type IgdbGamesQuery = {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: GameSort;
  platform?: string;
};

export type IgdbGamesResult = {
  provider: "igdb";
  query?: string;
  page: number;
  pageSize: number;
  count: number;
  nextPage: number | null;
  previousPage: number | null;
  results: IgdbGame[];
};

export class IgdbApiError extends Error {
  constructor(
    message: string,
    public readonly code: "missing-credentials" | "auth-failed" | "request-failed" | "invalid-response"
  ) {
    super(message);
    this.name = "IgdbApiError";
  }
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function getIgdbCredentials() {
  const clientId = process.env.IGDB_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim() ?? "";

  if (!clientId || !clientSecret) {
    throw new IgdbApiError("Faltan IGDB_CLIENT_ID o IGDB_CLIENT_SECRET en .env.", "missing-credentials");
  }

  return { clientId, clientSecret };
}

function clampPositiveInteger(value: number | undefined, fallback: number, max?: number) {
  const parsed = Number.isFinite(value) ? Math.floor(Number(value)) : fallback;
  const positive = Math.max(1, parsed);
  return max ? Math.min(max, positive) : positive;
}

function escapeIgdbString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function getUnixTimestamp(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function getTodayUnixTimestamp() {
  const now = new Date();
  return getUnixTimestamp(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
}

async function getIgdbAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getIgdbCredentials();
  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new IgdbApiError(`Twitch OAuth respondió con estado ${response.status}.`, "auth-failed");
  }

  let data: IgdbTokenResponse;
  try {
    data = (await response.json()) as IgdbTokenResponse;
  } catch {
    throw new IgdbApiError("Twitch OAuth devolvió una respuesta inválida.", "invalid-response");
  }

  if (!data.access_token) {
    throw new IgdbApiError("Twitch OAuth no devolvió access_token.", "auth-failed");
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + Math.max(60, data.expires_in ?? 3600) * 1000
  };

  return data.access_token;
}

async function fetchIgdb<T>(endpoint: string, body: string) {
  const { clientId } = getIgdbCredentials();
  const accessToken = await getIgdbAccessToken();

  const response = await fetch(`${IGDB_API_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`
    },
    body,
    next: { revalidate: 60 * 60 }
  });

  if (!response.ok) {
    throw new IgdbApiError(`IGDB respondió con estado ${response.status}.`, "request-failed");
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new IgdbApiError("IGDB devolvió una respuesta inválida.", "invalid-response");
  }
}

function buildGamesQuery({
  query,
  offset,
  pageSize,
  includeLimit = true,
  sort,
  platformId
}: {
  query?: string;
  offset?: number;
  pageSize?: number;
  includeLimit?: boolean;
  sort?: GameSort;
  platformId?: number | null;
}) {
  const normalizedQuery = query?.trim();
  const today = getTodayUnixTimestamp();
  const whereConditions = ["game_type = 0"];

  if (sort === "recent") {
    whereConditions.push(`first_release_date <= ${today}`);
  }

  if (sort === "upcoming") {
    whereConditions.push(`first_release_date > ${today}`);
  }

  if (typeof platformId === "number") {
    whereConditions.push(`platforms = (${platformId})`);
  }

  const clauses = [
    normalizedQuery ? `search "${escapeIgdbString(normalizedQuery)}";` : "",
    "fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,rating,total_rating,rating_count,total_rating_count,aggregated_rating,game_type.type;",
    // game_type 0 = Main Game. `category` está deprecated en la API actual.
    `where ${whereConditions.join(" & ")};`,
    getIgdbSortClause(sort),
    includeLimit ? `limit ${pageSize ?? IGDB_PAGE_SIZE};` : "",
    includeLimit ? `offset ${offset ?? 0};` : ""
  ];

  return clauses.filter(Boolean).join("\n");
}

function getIgdbSortClause(sort?: GameSort) {
  switch (sort) {
    case "score":
      return "sort total_rating desc;";
    case "recent":
      return "sort first_release_date desc;";
    case "upcoming":
      return "sort first_release_date asc;";
    case "reviewed":
    case "popular":
    default:
      return "sort total_rating_count desc;";
  }
}

async function countIgdbGames(query?: string, sort?: GameSort, platformId?: number | null) {
  const normalizedQuery = query?.trim();
  const today = getTodayUnixTimestamp();
  const whereConditions = ["game_type = 0"];

  if (sort === "recent") {
    whereConditions.push(`first_release_date <= ${today}`);
  }

  if (sort === "upcoming") {
    whereConditions.push(`first_release_date > ${today}`);
  }

  if (typeof platformId === "number") {
    whereConditions.push(`platforms = (${platformId})`);
  }

  const body = [
    normalizedQuery ? `search "${escapeIgdbString(normalizedQuery)}";` : "",
    `where ${whereConditions.join(" & ")};`
  ]
    .filter(Boolean)
    .join("\n");

  const data = await fetchIgdb<{ count?: number }>("games/count", body);
  return data.count ?? 0;
}

export async function listIgdbGames({
  query,
  page = 1,
  pageSize = IGDB_PAGE_SIZE,
  sort,
  platform
}: IgdbGamesQuery = {}): Promise<IgdbGamesResult> {
  const safePage = clampPositiveInteger(page, 1);
  const safePageSize = clampPositiveInteger(pageSize, IGDB_PAGE_SIZE, IGDB_MAX_PAGE_SIZE);
  const normalizedQuery = query?.trim();
  const offset = (safePage - 1) * safePageSize;

  let platformId: number | null = null;
  if (platform) {
    platformId = await resolveIgdbPlatformId(platform);
    if (platformId === null) {
      return {
        provider: "igdb",
        query: normalizedQuery || undefined,
        page: safePage,
        pageSize: safePageSize,
        count: 0,
        nextPage: null,
        previousPage: safePage > 1 ? safePage - 1 : null,
        results: []
      };
    }
  }

  const [results, count] = await Promise.all([
    fetchIgdb<IgdbGame[]>("games", buildGamesQuery({ query: normalizedQuery, offset, pageSize: safePageSize, sort, platformId })),
    countIgdbGames(normalizedQuery, sort, platformId)
  ]);
  const hasNextPage = offset + safePageSize < count;

  return {
    provider: "igdb",
    query: normalizedQuery || undefined,
    page: safePage,
    pageSize: safePageSize,
    count,
    nextPage: hasNextPage ? safePage + 1 : null,
    previousPage: safePage > 1 ? safePage - 1 : null,
    results: results ?? []
  };
}

export async function searchIgdbGames(query: string, page = 1, pageSize = IGDB_PAGE_SIZE) {
  return listIgdbGames({ query, page, pageSize });
}

type IgdbGenre = { id?: number; name?: string };

let cachedGenres: IgdbGenre[] | null = null;

async function fetchIgdbGenres(): Promise<IgdbGenre[]> {
  if (cachedGenres) return cachedGenres;
  const data = await fetchIgdb<IgdbGenre[]>("genres", "fields id,name; limit 100;");
  cachedGenres = data ?? [];
  return cachedGenres;
}

async function resolveIgdbGenreId(name: string): Promise<number | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const genres = await fetchIgdbGenres();
  const direct = genres.find((genre) => (genre.name ?? "").trim().toLowerCase() === normalized);
  if (direct?.id) return direct.id;
  const partial = genres.find((genre) => (genre.name ?? "").trim().toLowerCase().includes(normalized));
  return partial?.id ?? null;
}

type IgdbTheme = { id?: number; name?: string };

let cachedThemes: IgdbTheme[] | null = null;

async function fetchIgdbThemes(): Promise<IgdbTheme[]> {
  if (cachedThemes) return cachedThemes;
  const data = await fetchIgdb<IgdbTheme[]>("themes", "fields id,name; limit 100;");
  cachedThemes = data ?? [];
  return cachedThemes;
}

async function resolveIgdbThemeId(name: string): Promise<number | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const themes = await fetchIgdbThemes();
  const direct = themes.find((theme) => (theme.name ?? "").trim().toLowerCase() === normalized);
  if (direct?.id) return direct.id;
  const partial = themes.find((theme) => (theme.name ?? "").trim().toLowerCase().includes(normalized));
  return partial?.id ?? null;
}

type IgdbPlatform = { id?: number; name?: string; slug?: string; abbreviation?: string; alternative_name?: string };

let cachedPlatforms: IgdbPlatform[] | null = null;

async function fetchIgdbPlatforms(): Promise<IgdbPlatform[]> {
  if (cachedPlatforms) return cachedPlatforms;
  const data = await fetchIgdb<IgdbPlatform[]>(
    "platforms",
    "fields id,name,slug,abbreviation,alternative_name; limit 500;"
  );
  cachedPlatforms = data ?? [];
  return cachedPlatforms;
}

export async function resolveIgdbPlatformId(value: string): Promise<number | null> {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const slugified = slugify(value);
  const platforms = await fetchIgdbPlatforms();

  const matchers: Array<(platform: IgdbPlatform) => boolean> = [
    (platform) => (platform.slug ?? "").toLowerCase() === slugified,
    (platform) => (platform.name ?? "").trim().toLowerCase() === normalized,
    (platform) => (platform.abbreviation ?? "").trim().toLowerCase() === normalized,
    (platform) => (platform.alternative_name ?? "").trim().toLowerCase() === normalized,
    (platform) => (platform.name ?? "").trim().toLowerCase().includes(normalized)
  ];

  for (const match of matchers) {
    const found = platforms.find(match);
    if (found?.id) return found.id;
  }

  return null;
}

export type IgdbCuratedListQuery = {
  genreName?: string;
  themeName?: string;
  themeNames?: string[];
  upcoming?: boolean;
  year?: number;
  limit?: number;
};

export async function fetchIgdbGamesForCuratedList({
  genreName,
  themeName,
  themeNames,
  upcoming,
  year,
  limit = 100
}: IgdbCuratedListQuery): Promise<IgdbGame[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const today = getTodayUnixTimestamp();
  const whereConditions = ["game_type = 0"];

  if (genreName) {
    const genreId = await resolveIgdbGenreId(genreName);
    if (!genreId) return [];
    whereConditions.push(`genres = (${genreId})`);
  }

  const themeIds: number[] = [];
  if (themeNames && themeNames.length) {
    for (const name of themeNames) {
      const id = await resolveIgdbThemeId(name);
      if (!id) return [];
      themeIds.push(id);
    }
  } else if (themeName) {
    const id = await resolveIgdbThemeId(themeName);
    if (!id) return [];
    themeIds.push(id);
  }

  if (themeIds.length === 1) {
    whereConditions.push(`themes = (${themeIds[0]})`);
  } else if (themeIds.length > 1) {
    whereConditions.push(`themes = [${themeIds.join(",")}]`);
  }

  if (upcoming) {
    whereConditions.push(`first_release_date > ${today}`);
  } else {
    whereConditions.push(`first_release_date != null`);
  }

  if (typeof year === "number" && Number.isFinite(year)) {
    const yearStart = getUnixTimestamp(new Date(Date.UTC(year, 0, 1)));
    const yearEnd = getUnixTimestamp(new Date(Date.UTC(year + 1, 0, 1)));
    whereConditions.push(`first_release_date >= ${yearStart}`);
    whereConditions.push(`first_release_date < ${yearEnd}`);
  }

  const sortClause = upcoming
    ? "sort first_release_date asc;"
    : "sort total_rating_count desc;";

  const collected: IgdbGame[] = [];
  const seen = new Set<number>();
  const pageSize = IGDB_MAX_PAGE_SIZE;

  for (let offset = 0; collected.length < safeLimit && offset < safeLimit * 4; offset += pageSize) {
    const body = [
      "fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,rating,total_rating,rating_count,total_rating_count,aggregated_rating,game_type.type;",
      `where ${whereConditions.join(" & ")};`,
      sortClause,
      `limit ${pageSize};`,
      `offset ${offset};`
    ].join("\n");

    const batch = await fetchIgdb<IgdbGame[]>("games", body);
    if (!batch?.length) break;

    for (const game of batch) {
      if (typeof game.id !== "number" || seen.has(game.id)) continue;
      seen.add(game.id);
      collected.push(game);
      if (collected.length >= safeLimit) break;
    }

    if (batch.length < pageSize) break;
  }

  return collected;
}

export async function getIgdbGameById(idOrSlug: string) {
  const normalized = idOrSlug.trim();
  const numericId = Number(normalized);
  const whereClause = Number.isFinite(numericId)
    ? `where id = ${Math.floor(numericId)};`
    : `where slug = "${escapeIgdbString(normalized)}";`;

  const games = await fetchIgdb<IgdbGame[]>(
    "games",
    [
      "fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,rating,total_rating,rating_count,total_rating_count,aggregated_rating,game_type.type;",
      whereClause,
      "limit 1;"
    ].join("\n")
  );

  return games[0] ?? null;
}

function normalizeIgdbImageUrl(url?: string) {
  if (!url) return undefined;

  const withProtocol = url.startsWith("//") ? `https:${url}` : url;
  return withProtocol.replace("/t_thumb/", "/t_cover_big/");
}

function namesFromCompanies(companies: IgdbInvolvedCompany[] | undefined, key: "developer" | "publisher") {
  return companies
    ?.filter((item) => item[key])
    .map((item) => item.company?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

export function normalizeIgdbGame(rawGame: IgdbGame): NormalizedExternalGame {
  const title = rawGame.name ?? "Juego sin título";
  const releaseDate = rawGame.first_release_date
    ? new Date(rawGame.first_release_date * 1000).toISOString().slice(0, 10)
    : undefined;

  return {
    externalId: String(rawGame.id ?? slugify(title)),
    provider: "igdb",
    slug: rawGame.slug ?? slugify(title),
    title,
    summary: rawGame.summary,
    releaseYear: releaseDate ? new Date(releaseDate).getFullYear() : undefined,
    releaseDate,
    coverUrl: normalizeIgdbImageUrl(rawGame.cover?.url),
    platforms: rawGame.platforms?.map((platform) => platform.name ?? "").filter(Boolean) ?? [],
    genres: rawGame.genres?.map((genre) => genre.name ?? "").filter(Boolean) ?? [],
    developer: namesFromCompanies(rawGame.involved_companies, "developer") || undefined,
    publisher: namesFromCompanies(rawGame.involved_companies, "publisher") || undefined,
    rating: rawGame.total_rating ?? rawGame.rating ?? undefined,
    ratingsCount: rawGame.total_rating_count ?? rawGame.rating_count ?? 0,
    reviewsCount: 0,
    metacritic: rawGame.aggregated_rating ? Math.round(rawGame.aggregated_rating) : null
  };
}


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
    // IGDB rechaza `search` + `sort` (HTTP 406): "Search is sorting on relevancy".
    normalizedQuery ? "" : getIgdbSortClause(sort),
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

type IgdbScreenshot = { id?: number; image_id?: string; width?: number; height?: number };
type IgdbVideo = { id?: number; name?: string; video_id?: string };
type IgdbReleaseDate = {
  id?: number;
  date?: number;
  human?: string;
  region?: number;
  platform?: { id?: number; name?: string };
};
type IgdbDlcRef = { id?: number; name?: string; slug?: string; cover?: { id?: number; image_id?: string; url?: string } };
type IgdbFranchiseRef = { id?: number; name?: string; slug?: string };
type IgdbGameMode = { id?: number; name?: string };
type IgdbWebsite = { id?: number; url?: string; category?: number };

export type IgdbRichGameDetails = {
  screenshots: Array<{ url: string; width?: number; height?: number }>;
  videos: Array<{ id: string; name: string }>;
  dlcs: Array<{ name: string; slug: string | null; coverUrl: string | null; kind: "dlc" | "expansion" }>;
  releaseDates: Array<{ date: string | null; human: string | null; region: string | null; platform: string | null }>;
  franchises: Array<{ name: string; slug: string | null }>;
  gameModes: string[];
  websites: Array<{ category: WebsiteCategory; url: string }>;
};

export type WebsiteCategory =
  | "official"
  | "steam"
  | "wikipedia"
  | "youtube"
  | "twitch"
  | "instagram"
  | "twitter"
  | "reddit"
  | "discord"
  | "epic"
  | "gog"
  | "other";

const IGDB_REGION_MAP: Record<number, string> = {
  1: "Europa",
  2: "Norteamérica",
  3: "Australia",
  4: "Nueva Zelanda",
  5: "Japón",
  6: "China",
  7: "Asia",
  8: "Mundial",
  9: "Corea"
};

const IGDB_WEBSITE_CATEGORY_MAP: Record<number, WebsiteCategory> = {
  1: "official",
  2: "wikipedia",
  3: "wikipedia",
  5: "twitter",
  6: "twitch",
  8: "instagram",
  9: "youtube",
  10: "instagram",
  13: "steam",
  14: "reddit",
  15: "other",
  16: "epic",
  17: "gog",
  18: "discord"
};

const IGDB_RICH_DETAILS_FIELDS = [
  "id",
  "screenshots.image_id",
  "screenshots.width",
  "screenshots.height",
  "videos.video_id",
  "videos.name",
  "release_dates.date",
  "release_dates.human",
  "release_dates.region",
  "release_dates.platform.name",
  "dlcs.id",
  "dlcs.name",
  "dlcs.slug",
  "dlcs.cover.image_id",
  "expansions.id",
  "expansions.name",
  "expansions.slug",
  "expansions.cover.image_id",
  "franchises.id",
  "franchises.name",
  "franchises.slug",
  "franchise.id",
  "franchise.name",
  "franchise.slug",
  "game_modes.name",
  "websites.url",
  "websites.category"
].join(",");

export async function getIgdbRichGameDetails(igdbId: string | number): Promise<IgdbRichGameDetails | null> {
  const numericId = Number(igdbId);
  if (!Number.isFinite(numericId)) return null;

  try {
    const rows = await fetchIgdb<Array<{
      id?: number;
      screenshots?: IgdbScreenshot[];
      videos?: IgdbVideo[];
      release_dates?: IgdbReleaseDate[];
      dlcs?: IgdbDlcRef[];
      expansions?: IgdbDlcRef[];
      franchises?: IgdbFranchiseRef[];
      franchise?: IgdbFranchiseRef;
      game_modes?: IgdbGameMode[];
      websites?: IgdbWebsite[];
    }>>(
      "games",
      [
        `fields ${IGDB_RICH_DETAILS_FIELDS};`,
        `where id = ${Math.floor(numericId)};`,
        "limit 1;"
      ].join("\n")
    );

    const row = rows?.[0];
    if (!row) return null;

    const screenshots = (row.screenshots ?? [])
      .filter((screenshot) => screenshot.image_id)
      .map((screenshot) => ({
        url: `https://images.igdb.com/igdb/image/upload/t_screenshot_huge/${screenshot.image_id}.jpg`,
        width: screenshot.width,
        height: screenshot.height
      }));

    const videos = (row.videos ?? [])
      .filter((video) => video.video_id)
      .map((video) => ({ id: video.video_id as string, name: video.name ?? "Vídeo" }));

    const dlcs = [
      ...(row.dlcs ?? []).map((entry) => mapDlc(entry, "dlc")),
      ...(row.expansions ?? []).map((entry) => mapDlc(entry, "expansion"))
    ].filter((entry): entry is IgdbRichGameDetails["dlcs"][number] => entry !== null);

    const releaseDates = (row.release_dates ?? []).map<IgdbRichGameDetails["releaseDates"][number]>((entry) => ({
      date: entry.date ? new Date(entry.date * 1000).toISOString().slice(0, 10) : null,
      human: entry.human ?? null,
      region: entry.region && IGDB_REGION_MAP[entry.region] ? IGDB_REGION_MAP[entry.region] : null,
      platform: entry.platform?.name ?? null
    }));

    const franchiseEntries: IgdbFranchiseRef[] = [];
    if (row.franchise) franchiseEntries.push(row.franchise);
    if (Array.isArray(row.franchises)) franchiseEntries.push(...row.franchises);
    const franchises = dedupeFranchises(franchiseEntries);

    const gameModes = (row.game_modes ?? [])
      .map((mode) => mode.name?.trim())
      .filter((name): name is string => Boolean(name));

    const websites = (row.websites ?? [])
      .filter((site) => site.url)
      .map<IgdbRichGameDetails["websites"][number]>((site) => ({
        category:
          (site.category && IGDB_WEBSITE_CATEGORY_MAP[site.category]) ||
          detectWebsiteCategory(site.url ?? ""),
        url: site.url as string
      }));

    return { screenshots, videos, dlcs, releaseDates, franchises, gameModes, websites };
  } catch {
    return null;
  }
}

function mapDlc(entry: IgdbDlcRef, kind: "dlc" | "expansion") {
  if (!entry?.name) return null;
  const coverId = entry.cover?.image_id;
  return {
    name: entry.name,
    slug: entry.slug ?? null,
    coverUrl: coverId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverId}.jpg` : null,
    kind
  };
}

function dedupeFranchises(entries: IgdbFranchiseRef[]) {
  const seen = new Set<string>();
  const result: IgdbRichGameDetails["franchises"] = [];
  for (const entry of entries) {
    if (!entry?.name) continue;
    const key = (entry.slug ?? entry.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name: entry.name, slug: entry.slug ?? null });
  }
  return result;
}

function detectWebsiteCategory(url: string): WebsiteCategory {
  const lower = url.toLowerCase();
  if (lower.includes("store.steampowered.com")) return "steam";
  if (lower.includes("epicgames.com")) return "epic";
  if (lower.includes("gog.com")) return "gog";
  if (lower.includes("youtube.com")) return "youtube";
  if (lower.includes("twitch.tv")) return "twitch";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "twitter";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("reddit.com")) return "reddit";
  if (lower.includes("discord.com") || lower.includes("discord.gg")) return "discord";
  if (lower.includes("wikipedia.org")) return "wikipedia";
  return "other";
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


import type { Game, GameSort, GameStatus } from "@/data/games";
import {
  getIgdbGameById,
  IgdbApiError,
  IGDB_PAGE_SIZE,
  listIgdbGames,
  type IgdbGame,
  type NormalizedExternalGame,
  normalizeIgdbGame
} from "@/services/igdb";
import {
  getRawgGameById,
  listRawgGames,
  normalizeRawgGame,
  RawgApiError,
  RAWG_PAGE_SIZE
} from "@/services/rawg";
import { createServiceDatabaseClient, createSqlClient } from "@/services/database";
import { fromSearchDocument, indexGame, indexGames, searchGames } from "@/services/search";
import { slugify } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80";

type ExploreGamesParams = {
  query?: string;
  page?: number;
  pageSize?: number;
  platform?: string;
  genre?: string;
  year?: number;
  status?: string;
  scoreMin?: number;
  sort?: GameSort;
};

const GLOBAL_TRENDING_QUERIES = [
  "Counter-Strike 2",
  "Dota 2",
  "PUBG: Battlegrounds",
  "Grand Theft Auto V",
  "Rust",
  "Apex Legends",
  "League of Legends",
  "Valorant",
  "Fortnite",
  "Minecraft",
  "World of Warcraft",
  "Overwatch 2"
] as const;

export type ExploreGamesResult = {
  games: Game[];
  source: "meili" | "neon" | "igdb" | "rawg" | "none";
  count: number;
  page: number;
  pageSize: number;
  nextPage: number | null;
  previousPage: number | null;
  query?: string;
  facets?: Record<string, Record<string, number>>;
  error?: string;
};

export type IgdbScoreSummary = {
  source: "IGDB";
  averageScore: number | null;
  ratingsCount: number | null;
  criticScore: number | null;
};

export async function getHomeCollections() {
  const [trending, upcoming, newReleases, topRated, indieGems, topRpg, bestOfYear] = await Promise.all([
    getGlobalTrendingGames(12),
    getExploreGames({ status: "upcoming", pageSize: 12, sort: "upcoming" }),
    getExploreGames({ pageSize: 12, sort: "recent" }),
    getExploreGames({ pageSize: 12, sort: "score", scoreMin: 7 }),
    getExploreGames({ genre: "Indie", pageSize: 12, sort: "score", scoreMin: 7 }),
    getExploreGames({ genre: "Role-playing (RPG)", pageSize: 12, sort: "score", scoreMin: 7 }),
    getExploreGames({ year: new Date().getFullYear(), status: "released", pageSize: 12, sort: "score", scoreMin: 7 })
  ]);

  return {
    trending: trending.slice(0, 6),
    topRated: topRated.games.slice(0, 6),
    upcoming: upcoming.games.slice(0, 6),
    newReleases: newReleases.games.slice(0, 6),
    indieGems: indieGems.games.slice(0, 6),
    topRpg: topRpg.games.slice(0, 6),
    bestOfYear: bestOfYear.games.slice(0, 6)
  };
}

async function getGlobalTrendingGames(limit: number) {
  const fallbackPromise = getExploreGames({ pageSize: Math.max(24, limit * 2), sort: "popular" })
    .then((result) => result.games)
    .catch(() => [] as Game[]);

  const trendMatches = await Promise.all(
    GLOBAL_TRENDING_QUERIES.map((query) => resolveTrendingGame(query))
  );
  const fallback = await fallbackPromise;

  return dedupeGames([...trendMatches.filter(Boolean), ...fallback] as Game[]).slice(0, limit);
}

async function resolveTrendingGame(query: string) {
  try {
    const databaseResult = await getExploreGamesFromDatabase({ query, pageSize: 3, sort: "popular" });
    const match = pickBestTrendMatch(query, databaseResult.games);
    if (match) return match;
  } catch {
    // If the local catalog is unavailable or stale, resolve the trend from the configured external API.
  }

  const externalResult = await getExploreGamesFromExternal({ query, pageSize: 3, sort: "popular" });
  return pickBestTrendMatch(query, externalResult.games) ?? externalResult.games[0] ?? null;
}

function pickBestTrendMatch(query: string, games: Game[]) {
  if (!games.length) return null;

  const normalizedQuery = normalizeTrendTitle(query);
  return (
    games.find((game) => normalizeTrendTitle(game.title) === normalizedQuery) ??
    games.find((game) => normalizeTrendTitle(game.title).includes(normalizedQuery)) ??
    games[0]
  );
}

function normalizeTrendTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeGames(games: Game[]) {
  const seen = new Set<string>();
  const deduped: Game[] = [];

  for (const game of games) {
    const key = game.slug || normalizeTrendTitle(game.title);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(game);
  }

  return deduped;
}

export async function getExploreGames(params: ExploreGamesParams = {}): Promise<ExploreGamesResult> {
  const page = getPositiveInteger(params.page, 1);
  const pageSize = getPositiveInteger(params.pageSize, IGDB_PAGE_SIZE, 100);
  const query = params.query?.trim() || undefined;
  const normalizedParams = { ...params, query, page, pageSize };
  const fallbackErrors: string[] = [];
  const shouldUseExternalCatalog = canUseExternalCatalog(normalizedParams);

  if (shouldUseExternalCatalog) {
    const externalResult = await getExploreGamesFromExternal(normalizedParams);
    if (externalResult.source !== "none") {
      return { ...externalResult, error: undefined };
    }

    if (externalResult.error) fallbackErrors.push(externalResult.error);
  }

  try {
    const meili = await searchGames(normalizedParams);
    if (meili.hits.length > 0 || hasCatalogFilters(normalizedParams)) {
      const count = meili.estimatedTotalHits;
      return {
        games: meili.hits.map(fromSearchDocument),
        source: "meili",
        count,
        page,
        pageSize,
        nextPage: page * pageSize < count ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        query,
        facets: meili.facetDistribution
      };
    }
  } catch (error) {
    fallbackErrors.push(getReadableSearchError(error));
  }

  try {
    const databaseResult = await getExploreGamesFromDatabase(normalizedParams);
    if (databaseResult.games.length > 0 || hasCatalogFilters(normalizedParams)) {
      void bestEffortIndexGames(databaseResult.games);
      return databaseResult;
    }
  } catch (error) {
    fallbackErrors.push(getReadableDatabaseError(error));
  }

  if (!shouldUseExternalCatalog) {
    const externalResult = await getExploreGamesFromExternal(normalizedParams);
    if (externalResult.source !== "none") {
      return { ...externalResult, error: undefined };
    }

    if (externalResult.error) fallbackErrors.push(externalResult.error);
  }

  const combinedError = fallbackErrors.filter(Boolean).join(" ").trim();
  return emptyApiResult({ query, page, pageSize, error: combinedError || "No se pudieron cargar videojuegos." });
}

export async function getExploreGamesFromRawg({
  query,
  page = 1,
  pageSize = RAWG_PAGE_SIZE,
  sort
}: ExploreGamesParams = {}): Promise<ExploreGamesResult> {
  try {
    const rawgGames = await listRawgGames({ query, page, pageSize, ordering: getRawgOrdering(sort), dates: getRawgDateRange(sort) });
    const games = rawgGames.results.map((game) => toGame(normalizeRawgGame(game)));
    void bestEffortPersistGames(rawgGames.results.map(normalizeRawgGame));
    void bestEffortIndexGames(games);

    return {
      games,
      source: "rawg",
      count: rawgGames.count,
      page: rawgGames.page,
      pageSize: rawgGames.pageSize,
      nextPage: rawgGames.nextPage,
      previousPage: rawgGames.previousPage,
      query: rawgGames.query
    };
  } catch (error) {
    return emptyApiResult({ query, page, pageSize, error: getReadableGamesError(error) });
  }
}

export async function getSimilarGames(game: Game, limit = 6): Promise<Game[]> {
  const candidates = new Map<string, Game>();
  const pageSize = Math.max(24, limit * 8);
  const primaryGenre = game.genres.find((genre) => genre && genre !== "Sin género");

  if (primaryGenre) {
    const genreResult = await getExploreGames({ genre: primaryGenre, pageSize, sort: "popular" });
    addCandidates(candidates, game, genreResult.games);
  }

  if (candidates.size < limit) {
    const popularResult = await getExploreGames({ pageSize, sort: "popular" });
    addCandidates(candidates, game, popularResult.games);
  }

  if (candidates.size < limit) {
    const externalResult = await getExploreGamesFromExternal({ pageSize, sort: "popular" });
    addCandidates(candidates, game, externalResult.games);
  }

  return Array.from(candidates.values())
    .map((candidate) => ({ candidate, score: getSimilarityScore(game, candidate) }))
    .sort((a, b) => b.score - a.score || b.candidate.userScore - a.candidate.userScore || b.candidate.ratings - a.candidate.ratings)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export async function getGameBySlug(slug: string) {
  const fromDatabase = await getGameBySlugFromDatabase(slug);
  if (fromDatabase) return fromDatabase;

  try {
    const igdbGame = await getIgdbGameById(slug);
    if (igdbGame) {
      const normalized = normalizeIgdbGame(igdbGame);
      const game = toGame(normalized);
      void bestEffortPersistGames([normalized]);
      void bestEffortIndexGames([game]);
      return withCommunityStats(game);
    }
  } catch {
    // Fallback to RAWG when IGDB is not configured or fails temporarily.
  }

  try {
    const rawgGame = await getRawgGameById(slug);
    const normalized = normalizeRawgGame(rawgGame);
    const game = toGame(normalized);
    void bestEffortPersistGames([normalized]);
    void bestEffortIndexGames([game]);
    return withCommunityStats(game);
  } catch {
    return null;
  }
}

async function getExploreGamesFromExternal(params: ExploreGamesParams): Promise<ExploreGamesResult> {
  const { query, page = 1, pageSize = IGDB_PAGE_SIZE, sort, platform } = params;
  try {
    const igdbGames = await listIgdbGames({ query, page, pageSize, sort, platform });
    const normalized = igdbGames.results.map(normalizeIgdbGame);
    const games = normalized.map(toGame);
    void bestEffortPersistGames(normalized);
    void bestEffortIndexGames(games);

    return {
      games,
      source: "igdb",
      count: igdbGames.count,
      page: igdbGames.page,
      pageSize: igdbGames.pageSize,
      nextPage: igdbGames.nextPage,
      previousPage: igdbGames.previousPage,
      query: igdbGames.query
    };
  } catch (igdbError) {
    try {
      const rawgGames = await listRawgGames({
        query,
        page,
        pageSize: Math.min(pageSize, RAWG_PAGE_SIZE),
        ordering: getRawgOrdering(sort),
        dates: getRawgDateRange(sort)
      });
      const normalized = rawgGames.results.map(normalizeRawgGame);
      const games = normalized.map(toGame);
      void bestEffortPersistGames(normalized);
      void bestEffortIndexGames(games);

      return {
        games,
        source: "rawg",
        count: rawgGames.count,
        page: rawgGames.page,
        pageSize: rawgGames.pageSize,
        nextPage: rawgGames.nextPage,
        previousPage: rawgGames.previousPage,
        query: rawgGames.query,
        error: getReadableGamesError(igdbError)
      };
    } catch (rawgError) {
      return emptyApiResult({
        query,
        page,
        pageSize,
        error: `${getReadableGamesError(igdbError)} ${getReadableGamesError(rawgError)}`
      });
    }
  }
}

async function getExploreGamesFromDatabase(params: ExploreGamesParams): Promise<ExploreGamesResult> {
  const page = getPositiveInteger(params.page, 1);
  const pageSize = getPositiveInteger(params.pageSize, IGDB_PAGE_SIZE, 100);
  const effectiveStatus = getEffectiveCatalogStatus(params);

  const restrictedIds = await getCatalogRestrictedGameIds(params);
  if (restrictedIds && restrictedIds.length === 0) {
    return {
      games: [],
      source: "neon",
      count: 0,
      page,
      pageSize,
      nextPage: null,
      previousPage: page > 1 ? page - 1 : null,
      query: params.query
    };
  }

  const client = createServiceDatabaseClient();
  let query = client
    .from("games")
    .select(
      "*, game_platforms(platforms(name)), game_genres(genres(name)), game_companies(role, companies(name))",
      { count: "exact" }
    );

  if (restrictedIds) query = query.in("id", restrictedIds);
  if (params.query) query = query.ilike("title", `%${params.query}%`);
  if (effectiveStatus) query = query.eq("status", effectiveStatus);
  if (params.year) {
    query = query.eq("release_year", params.year);
  } else if (params.sort === "upcoming") {
    query = query.gte("release_year", new Date().getFullYear());
  }
  if (params.scoreMin) query = query.gte("user_score", params.scoreMin);

  switch (params.sort) {
    case "score":
      query = query.order("user_score", { ascending: false }).order("rating_count", { ascending: false });
      break;
    case "recent":
      query = query.order("release_year", { ascending: false, nullsFirst: false });
      break;
    case "upcoming":
      query = query.order("release_year", { ascending: true, nullsFirst: false }).order("popularity_score", { ascending: false });
      break;
    case "reviewed":
      query = query.order("review_count", { ascending: false }).order("rating_count", { ascending: false });
      break;
    default:
      query = query.order("rating_count", { ascending: false }).order("review_count", { ascending: false }).order("user_score", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);

  const games = (data ?? []).map(gameFromDatabaseRow);
  const safeCount = count ?? games.length;
  return {
    games,
    source: "neon",
    count: safeCount,
    page,
    pageSize,
    nextPage: page * pageSize < safeCount ? page + 1 : null,
    previousPage: page > 1 ? page - 1 : null,
    query: params.query
  };
}

async function getCatalogRestrictedGameIds(params: ExploreGamesParams): Promise<string[] | null> {
  if (!params.platform && !params.genre) return null;

  const sql = createSqlClient();
  const idSets: string[][] = [];

  if (params.platform) {
    const rows = (await sql.query(
      `select gp.game_id::text as game_id
       from game_platforms gp
       join platforms p on p.id = gp.platform_id
       where lower(p.name) = lower($1) or p.slug = $2`,
      [params.platform, slugify(params.platform)]
    )) as Array<{ game_id: string }>;
    idSets.push(rows.map((row) => row.game_id));
  }

  if (params.genre) {
    const rows = (await sql.query(
      `select gg.game_id::text as game_id
       from game_genres gg
       join genres g on g.id = gg.genre_id
       where lower(g.name) = lower($1) or g.slug = $2`,
      [params.genre, slugify(params.genre)]
    )) as Array<{ game_id: string }>;
    idSets.push(rows.map((row) => row.game_id));
  }

  if (idSets.length === 0) return null;
  return intersectIdSets(idSets);
}

function intersectIdSets(sets: string[][]): string[] {
  if (sets.length === 0) return [];
  const [first, ...rest] = sets;
  if (rest.length === 0) return Array.from(new Set(first));
  const counters = rest.map((set) => new Set(set));
  return Array.from(new Set(first)).filter((id) => counters.every((set) => set.has(id)));
}

export async function getPlatformBySlug(slug: string): Promise<{ id: string; slug: string; name: string } | null> {
  try {
    const client = createServiceDatabaseClient();
    const { data } = await client
      .from("platforms")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();
    if (data) return data as { id: string; slug: string; name: string };
  } catch {
    // Database may be unavailable — fall back to deriving the name from the slug.
  }
  return null;
}

async function getGameBySlugFromDatabase(slug: string): Promise<Game | null> {
  try {
    const client = createServiceDatabaseClient();
    const { data, error } = await client
      .from("games")
      .select("*, game_platforms(platforms(name)), game_genres(genres(name)), game_companies(role, companies(name))")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;
    return gameFromDatabaseRow(data);
  } catch {
    return null;
  }
}

async function getIgdbLookupKeys(slug: string) {
  const keys: string[] = [];

  try {
    const client = createServiceDatabaseClient();
    const { data: game } = await client.from("games").select("id").eq("slug", slug).maybeSingle();

    if (game?.id) {
      const { data: sources } = await client
        .from("external_sources")
        .select("external_id")
        .eq("game_id", game.id)
        .eq("provider", "igdb")
        .limit(1);

      const externalId = sources?.[0]?.external_id;
      if (externalId) keys.push(String(externalId));
    }
  } catch {
    // If the database is unavailable, try the route slug directly against IGDB.
  }

  keys.push(slug);

  return Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));
}

function toIgdbScoreSummary(rawGame: IgdbGame): IgdbScoreSummary | null {
  const averageScore = toScoreOutOfTen(rawGame.rating);
  const ratingsCount = toPositiveInteger(rawGame.total_rating_count ?? rawGame.rating_count);
  const criticScore = toScoreOutOfHundred(rawGame.aggregated_rating);
  const hasData =
    averageScore !== null ||
    (ratingsCount !== null && ratingsCount > 0) ||
    criticScore !== null;

  if (!hasData) return null;

  return {
    source: "IGDB",
    averageScore,
    ratingsCount,
    criticScore
  };
}

function toScoreOutOfTen(value: number | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) return null;
  return Number((Number(value) / 10).toFixed(1));
}

function toScoreOutOfHundred(value: number | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) return null;
  return Math.round(Number(value));
}

function toPositiveInteger(value: number | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) return null;
  return Math.floor(Number(value));
}

async function withCommunityStats(game: Game): Promise<Game> {
  try {
    const db = createServiceDatabaseClient();
    const { data } = await db
      .from("games")
      .select("user_score, rating_count, review_count")
      .eq("slug", game.slug)
      .maybeSingle();

    if (!data) return game;

    return {
      ...game,
      userScore: Number(data.user_score ?? game.userScore),
      ratings: Number(data.rating_count ?? game.ratings),
      reviews: Number(data.review_count ?? game.reviews)
    };
  } catch {
    return game;
  }
}

export async function persistExternalGame(externalGame: NormalizedExternalGame) {
  const client = createServiceDatabaseClient();
  const game = toGame(externalGame);
  const { data, error } = await client
    .from("games")
    .upsert(
      {
        slug: game.slug,
        title: game.title,
        summary: game.summary,
        release_year: game.year > 0 ? game.year : null,
        status: game.status,
        cover_url: game.coverUrl,
        hero_url: game.heroUrl,
        user_score: game.userScore,
        critic_score: game.criticScore,
        rating_count: game.ratings,
        review_count: game.reviews,
        popularity_score: game.ratings + game.reviews * 2,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo persistir el juego.");

  await Promise.all([
    syncNames(client, "platforms", "game_platforms", "platform_id", data.id, externalGame.platforms),
    syncNames(client, "genres", "game_genres", "genre_id", data.id, externalGame.genres),
    syncCompanies(client, data.id, externalGame.developer, "developer"),
    syncCompanies(client, data.id, externalGame.publisher, "publisher"),
    client.from("external_sources").upsert(
      {
        game_id: data.id,
        provider: externalGame.provider,
        external_id: externalGame.externalId,
        synced_at: new Date().toISOString()
      },
      { onConflict: "provider,external_id" }
    )
  ]);

  await indexGame(game).catch(() => null);
  return data.id as string;
}

async function bestEffortPersistGames(games: NormalizedExternalGame[]) {
  try {
    await Promise.allSettled(games.map((game) => persistExternalGame(game)));
  } catch {
    // background task — swallow errors so unhandled rejections don't crash the runtime
  }
}

async function bestEffortIndexGames(games: Game[]) {
  await indexGames(games).catch(() => null);
}

async function syncNames(
  client: ReturnType<typeof createServiceDatabaseClient>,
  table: "platforms" | "genres",
  joinTable: "game_platforms" | "game_genres",
  foreignKey: "platform_id" | "genre_id",
  gameId: string,
  values: string[]
) {
  for (const name of values.slice(0, 12)) {
    const cleanName = name.trim();
    if (!cleanName) continue;
    const slug = slugify(cleanName);
    const { data } = await client.from(table).upsert({ slug, name: cleanName }, { onConflict: "slug" }).select("id").single();
    if (data?.id) {
      await client.from(joinTable).upsert({ game_id: gameId, [foreignKey]: data.id } as never, {
        onConflict: `game_id,${foreignKey}`
      });
    }
  }
}

async function syncCompanies(
  client: ReturnType<typeof createServiceDatabaseClient>,
  gameId: string,
  names: string | undefined,
  role: "developer" | "publisher"
) {
  for (const name of (names ?? "").split(",").map((value) => value.trim()).filter(Boolean).slice(0, 8)) {
    const slug = slugify(name);
    const { data } = await client.from("companies").upsert({ slug, name }, { onConflict: "slug" }).select("id").single();
    if (data?.id) {
      await client.from("game_companies").upsert({ game_id: gameId, company_id: data.id, role }, {
        onConflict: "game_id,company_id,role"
      });
    }
  }
}

function gameFromDatabaseRow(row: any): Game {
  const platforms = (row.game_platforms ?? [])
    .map((item: any) => item.platforms?.name)
    .filter(Boolean);
  const genres = (row.game_genres ?? []).map((item: any) => item.genres?.name).filter(Boolean);
  const companies = row.game_companies ?? [];
  const developer = companies
    .filter((item: any) => item.role === "developer")
    .map((item: any) => item.companies?.name)
    .filter(Boolean)
    .join(", ");
  const publisher = companies
    .filter((item: any) => item.role === "publisher")
    .map((item: any) => item.companies?.name)
    .filter(Boolean)
    .join(", ");

  return {
    title: row.title,
    slug: row.slug,
    year: Number(row.release_year ?? 0),
    platforms: platforms.length ? platforms : ["Plataformas por confirmar"],
    genres: genres.length ? genres : ["Sin género"],
    developer: developer || "Desarrolladora no disponible",
    publisher: publisher || "Publisher no disponible",
    userScore: Number(row.user_score ?? 0),
    criticScore: row.critic_score === null || row.critic_score === undefined ? null : Number(row.critic_score),
    reviews: Number(row.review_count ?? 0),
    ratings: Number(row.rating_count ?? 0),
    status: isGameStatus(row.status) ? row.status : "released",
    coverUrl: row.cover_url || FALLBACK_IMAGE,
    heroUrl: row.hero_url || row.cover_url || FALLBACK_IMAGE,
    summary: row.summary || "Sinopsis no disponible.",
    modes: ["Información no disponible"],
    releaseDate: row.release_date ?? (row.release_year ? String(row.release_year) : "Fecha por anunciar")
  };
}

function emptyApiResult({
  query,
  page,
  pageSize,
  error
}: ExploreGamesParams & { error: string }): ExploreGamesResult {
  return {
    games: [],
    source: "none",
    count: 0,
    page: getPositiveInteger(page, 1),
    pageSize: getPositiveInteger(pageSize, IGDB_PAGE_SIZE),
    nextPage: null,
    previousPage: null,
    query: query?.trim() || undefined,
    error
  };
}

function toGame(externalGame: NormalizedExternalGame): Game {
  const score = externalGame.rating
    ? Number((externalGame.provider === "igdb" ? externalGame.rating / 10 : externalGame.rating * 2).toFixed(1))
    : 0;
  const releaseDate = externalGame.releaseDate ?? "Fecha por anunciar";
  const status = getStatusFromReleaseDate(externalGame.releaseDate);

  return {
    title: externalGame.title,
    slug: externalGame.slug,
    year: externalGame.releaseYear ?? 0,
    platforms: externalGame.platforms.length ? externalGame.platforms : ["Plataformas por confirmar"],
    genres: externalGame.genres.length ? externalGame.genres : ["Sin género"],
    developer: externalGame.developer || "Desarrolladora no disponible",
    publisher: externalGame.publisher || "Publisher no disponible",
    userScore: score,
    criticScore: externalGame.metacritic ?? null,
    reviews: externalGame.reviewsCount ?? 0,
    ratings: externalGame.ratingsCount ?? 0,
    status,
    coverUrl: externalGame.coverUrl ?? FALLBACK_IMAGE,
    heroUrl: externalGame.coverUrl ?? FALLBACK_IMAGE,
    summary: externalGame.summary || "Sinopsis no disponible.",
    modes: ["Información no disponible"],
    releaseDate
  };
}

function getStatusFromReleaseDate(releaseDate?: string): GameStatus {
  if (!releaseDate) return "upcoming";
  const date = new Date(releaseDate);
  if (Number.isNaN(date.getTime())) return "released";
  return date.getTime() > Date.now() ? "upcoming" : "released";
}

function isGameStatus(value: unknown): value is GameStatus {
  return value === "released" || value === "upcoming" || value === "early_access";
}

function getReadableGamesError(error: unknown) {
  if (error instanceof IgdbApiError && error.code === "missing-credentials") {
    return "No se encontraron IGDB_CLIENT_ID/IGDB_CLIENT_SECRET en .env. Probando RAWG.";
  }
  if (error instanceof IgdbApiError) return `${error.message} Probando RAWG.`;
  if (error instanceof RawgApiError && error.code === "missing-key") {
    return "No se encontró RAWG_API_KEY en .env. Configura una API key para cargar videojuegos.";
  }
  if (error instanceof RawgApiError) return error.message;
  return "No se pudo conectar con las APIs de videojuegos.";
}

function getReadableSearchError(error: unknown) {
  return error instanceof Error ? "Meilisearch no disponible; usando fuentes alternativas." : "Meilisearch no disponible.";
}

function getReadableDatabaseError(error: unknown) {
  return error instanceof Error ? `Neon no disponible: ${error.message}.` : "Neon no disponible.";
}

function hasCatalogFilters(params: ExploreGamesParams) {
  return Boolean(params.query || params.platform || params.genre || params.year || params.status || params.scoreMin);
}

function canUseExternalCatalog(params: ExploreGamesParams) {
  // IGDB filtra por plataforma de forma nativa, así que sí podemos delegar en el catálogo externo.
  return !params.genre && !params.year && !params.status && !params.scoreMin;
}

function getEffectiveCatalogStatus(params: ExploreGamesParams) {
  if (params.sort === "upcoming") return "upcoming";
  if (params.sort === "recent" && !params.status) return "released";
  return params.status;
}

function getPositiveInteger(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);
  const positive = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  return max ? Math.min(max, positive) : positive;
}

function getRawgOrdering(sort?: GameSort) {
  switch (sort) {
    case "score":
      return "-rating";
    case "recent":
      return "-released";
    case "upcoming":
      return "released";
    case "reviewed":
      return "-reviews_count";
    default:
      return "-added";
  }
}

function getRawgDateRange(sort?: GameSort) {
  const today = new Date().toISOString().slice(0, 10);

  if (sort === "recent") {
    return `1970-01-01,${today}`;
  }

  if (sort === "upcoming") {
    return `${today},2100-12-31`;
  }

  return undefined;
}

export async function getIgdbScoreSummaryByGameSlug(slug: string): Promise<IgdbScoreSummary | null> {
  const lookupKeys = await getIgdbLookupKeys(slug);

  for (const key of lookupKeys) {
    try {
      const igdbGame = await getIgdbGameById(key);
      const summary = igdbGame ? toIgdbScoreSummary(igdbGame) : null;

      if (summary) return summary;
    } catch (error) {
      if (error instanceof IgdbApiError && error.code === "missing-credentials") {
        return null;
      }
    }
  }

  return null;
}

function addCandidates(candidates: Map<string, Game>, game: Game, nextCandidates: Game[]) {
  for (const candidate of nextCandidates) {
    if (candidate.slug !== game.slug && !candidates.has(candidate.slug)) {
      candidates.set(candidate.slug, candidate);
    }
  }
}

function getSimilarityScore(game: Game, candidate: Game) {
  const sharedGenres = countSharedValues(game.genres, candidate.genres);
  const sharedPlatforms = countSharedValues(game.platforms, candidate.platforms);
  const sameDeveloper = normalizeCompare(game.developer) === normalizeCompare(candidate.developer) ? 1 : 0;
  const samePublisher = normalizeCompare(game.publisher) === normalizeCompare(candidate.publisher) ? 1 : 0;
  const sameStatus = game.status === candidate.status ? 1 : 0;

  return (
    sharedGenres * 10 +
    sharedPlatforms * 3 +
    sameDeveloper * 4 +
    samePublisher * 2 +
    sameStatus +
    candidate.userScore / 10 +
    Math.log10(Math.max(1, candidate.ratings)) / 10
  );
}

function countSharedValues(left: string[], right: string[]) {
  const rightValues = new Set(right.map(normalizeCompare));
  return left.map(normalizeCompare).filter((value) => value && rightValues.has(value)).length;
}

function normalizeCompare(value: string) {
  return value.trim().toLowerCase();
}




import { createLogger } from "@/lib/logger";
import { createSqlClient } from "@/services/database";
import { getExploreGames } from "@/services/games";
import { logLlmCall } from "@/services/llm-metrics";
import type { Game } from "@/data/games";

const log = createLogger("services/recommendations");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TARGET_COUNT = 5;
const CANDIDATE_POOL_SIZE = 30;
const MIN_RATING_TO_LIKE = 7;
const MIN_RATING_TO_DISLIKE = 4;

export type Recommendation = {
  slug: string;
  title: string;
  coverUrl: string | null;
  reason: string;
  affinity: number | null;
  year: number | null;
  genres: string[];
};

export type RecommendationsResult = {
  recommendations: Recommendation[];
  source: "cache" | "fresh" | "empty";
  generatedAt: string | null;
  expiresAt: string | null;
  emptyReason?: "no-library" | "no-candidates" | "llm-unavailable";
};

type TasteProfile = {
  topGenres: string[];
  topPlatforms: string[];
  topDevelopers: string[];
  highRatedTitles: Array<{ title: string; score: number; slug: string }>;
  dislikedTitles: Array<{ title: string; score: number }>;
  ownedSlugs: Set<string>;
  ownedTitles: string[];
  hasLibrary: boolean;
  fallbackGenres: string[];
  fallbackPlatforms: string[];
};

export async function getRecommendationsForUser(
  userId: string,
  options: { force?: boolean } = {}
): Promise<RecommendationsResult> {
  if (!options.force) {
    const cached = await readCache(userId);
    if (cached) {
      void logLlmCall({ scope: "recommendations", outcome: "cache_hit", userId });
      return cached;
    }
  }

  const profile = await buildTasteProfile(userId);
  const candidates = await gatherCandidates(profile);

  if (candidates.length === 0) {
    return {
      recommendations: [],
      source: "empty",
      generatedAt: null,
      expiresAt: null,
      emptyReason: profile.hasLibrary ? "no-candidates" : "no-library"
    };
  }

  const ranked = await rankWithLLM(profile, candidates, userId);
  if (ranked.length === 0) {
    return {
      recommendations: [],
      source: "empty",
      generatedAt: null,
      expiresAt: null,
      emptyReason: "llm-unavailable"
    };
  }

  await persistRecommendations(userId, ranked);
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + CACHE_TTL_MS);

  return {
    recommendations: ranked,
    source: "fresh",
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}

async function readCache(userId: string): Promise<RecommendationsResult | null> {
  try {
    const sql = createSqlClient();
    const raw = await sql.query(
      `select ur.reason, ur.affinity_score, ur.position, ur.generated_at, ur.expires_at,
              g.slug, g.title, g.cover_url, g.release_year,
              coalesce(array_agg(distinct ge.name) filter (where ge.name is not null), '{}') as genres
       from user_recommendations ur
       join games g on g.id = ur.game_id
       left join game_genres gg on gg.game_id = g.id
       left join genres ge on ge.id = gg.genre_id
       where ur.user_id = $1 and ur.expires_at > now()
       group by ur.reason, ur.affinity_score, ur.position, ur.generated_at, ur.expires_at,
                g.slug, g.title, g.cover_url, g.release_year
       order by ur.position asc`,
      [userId]
    );
    const rows = raw as Array<{
      reason: string;
      affinity_score: string | null;
      position: number;
      generated_at: string;
      expires_at: string;
      slug: string;
      title: string;
      cover_url: string | null;
      release_year: number | null;
      genres: string[];
    }>;

    if (rows.length === 0) return null;

    return {
      recommendations: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        coverUrl: row.cover_url,
        reason: row.reason,
        affinity: row.affinity_score === null ? null : Number(row.affinity_score),
        year: row.release_year ?? null,
        genres: row.genres ?? []
      })),
      source: "cache",
      generatedAt: rows[0].generated_at,
      expiresAt: rows[0].expires_at
    };
  } catch (error) {
    log.warn("cache read failed", { error });
    return null;
  }
}

async function buildTasteProfile(userId: string): Promise<TasteProfile> {
  const sql = createSqlClient();

  const [favoritesRaw, ratingsRaw, statusesRaw, profileRaw] = await Promise.all([
    sql.query(
      `select g.slug, g.title, g.id
       from user_game_statuses ugs
       join games g on g.id = ugs.game_id
       where ugs.user_id = $1 and ugs.status = 'favorite'`,
      [userId]
    ),
    sql.query(
      `select g.slug, g.title, r.score
       from ratings r
       join games g on g.id = r.game_id
       where r.user_id = $1 and r.score is not null
       order by r.updated_at desc
       limit 50`,
      [userId]
    ),
    sql.query(
      `select g.slug, g.title, ugs.status
       from user_game_statuses ugs
       join games g on g.id = ugs.game_id
       where ugs.user_id = $1`,
      [userId]
    ),
    sql.query(
      `select favorite_genres, favorite_platforms
       from profiles
       where id = $1
       limit 1`,
      [userId]
    )
  ]);

  const favorites = favoritesRaw as Array<{ slug: string; title: string; id: string }>;
  const ratings = ratingsRaw as Array<{ slug: string; title: string; score: number }>;
  const statuses = statusesRaw as Array<{ slug: string; title: string; status: string }>;
  const profileRow = profileRaw as Array<{
    favorite_genres: string[] | null;
    favorite_platforms: string[] | null;
  }>;

  const ownedSlugs = new Set<string>();
  const ownedTitles: string[] = [];
  for (const row of statuses) {
    ownedSlugs.add(row.slug);
    ownedTitles.push(row.title);
  }
  for (const row of favorites) ownedSlugs.add(row.slug);

  const interestingSlugs = Array.from(
    new Set([
      ...favorites.map((row) => row.slug),
      ...ratings.filter((row) => row.score >= MIN_RATING_TO_LIKE).map((row) => row.slug),
      ...statuses.filter((row) => row.status === "completed").map((row) => row.slug)
    ])
  );

  const aggregatesRaw = interestingSlugs.length
    ? await sql.query(
        `select
           coalesce(array_agg(distinct ge.name) filter (where ge.name is not null), '{}') as genres,
           coalesce(array_agg(distinct p.name) filter (where p.name is not null), '{}') as platforms,
           coalesce(array_agg(distinct c.name) filter (where c.name is not null and gc.role = 'developer'), '{}') as developers
         from games g
         left join game_genres gg on gg.game_id = g.id
         left join genres ge on ge.id = gg.genre_id
         left join game_platforms gp on gp.game_id = g.id
         left join platforms p on p.id = gp.platform_id
         left join game_companies gc on gc.game_id = g.id
         left join companies c on c.id = gc.company_id
         where g.slug = any($1::text[])`,
        [interestingSlugs]
      )
    : [];

  const aggregates = aggregatesRaw as Array<{ genres: string[]; platforms: string[]; developers: string[] }>;
  const agg = aggregates[0];

  const profile = profileRow[0];
  const fallbackGenres = (profile?.favorite_genres ?? []).filter(Boolean);
  const fallbackPlatforms = (profile?.favorite_platforms ?? []).filter(Boolean);

  const highRatedTitles = ratings
    .filter((row) => row.score >= MIN_RATING_TO_LIKE)
    .slice(0, 10)
    .map((row) => ({ title: row.title, score: row.score, slug: row.slug }));

  const dislikedTitles = ratings
    .filter((row) => row.score <= MIN_RATING_TO_DISLIKE)
    .slice(0, 5)
    .map((row) => ({ title: row.title, score: row.score }));

  return {
    topGenres: (agg?.genres ?? []).slice(0, 6),
    topPlatforms: (agg?.platforms ?? []).slice(0, 6),
    topDevelopers: (agg?.developers ?? []).slice(0, 5),
    highRatedTitles,
    dislikedTitles,
    ownedSlugs,
    ownedTitles,
    hasLibrary: statuses.length > 0 || ratings.length > 0,
    fallbackGenres,
    fallbackPlatforms
  };
}

async function gatherCandidates(profile: TasteProfile): Promise<Game[]> {
  const seen = new Map<string, Game>();
  const genresToTry = profile.topGenres.length ? profile.topGenres : profile.fallbackGenres;
  const platform = profile.topPlatforms[0] ?? profile.fallbackPlatforms[0];

  const queries: Array<Promise<Game[]>> = [];

  if (genresToTry.length === 0) {
    queries.push(
      getExploreGames({ sort: "score", pageSize: 20, scoreMin: 7 }).then((r) => r.games)
    );
    queries.push(
      getExploreGames({ sort: "popular", pageSize: 20 }).then((r) => r.games)
    );
  } else {
    for (const genre of genresToTry.slice(0, 3)) {
      queries.push(
        getExploreGames({ genre, sort: "score", pageSize: 12, scoreMin: 7 }).then((r) => r.games)
      );
      queries.push(
        getExploreGames({ genre, sort: "popular", pageSize: 8 }).then((r) => r.games)
      );
    }
    if (platform) {
      queries.push(
        getExploreGames({ platform, sort: "score", pageSize: 12, scoreMin: 7 }).then((r) => r.games)
      );
    }
  }

  const results = await Promise.allSettled(queries);
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const game of result.value) {
      if (!game.slug) continue;
      if (profile.ownedSlugs.has(game.slug)) continue;
      if (seen.has(game.slug)) continue;
      seen.set(game.slug, game);
      if (seen.size >= CANDIDATE_POOL_SIZE) break;
    }
    if (seen.size >= CANDIDATE_POOL_SIZE) break;
  }

  return Array.from(seen.values());
}

async function rankWithLLM(
  profile: TasteProfile,
  candidates: Game[],
  userId?: string
): Promise<Recommendation[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    log.warn("missing GROQ_API_KEY — falling back to deterministic ranking");
    void logLlmCall({
      scope: "recommendations",
      outcome: "fallback",
      userId: userId ?? null,
      errorCode: "missing-api-key"
    });
    return deterministicRanking(profile, candidates);
  }

  const userBlock = buildProfileBlock(profile);
  const candidatesBlock = candidates
    .map(
      (game, index) =>
        `${index + 1}. slug="${game.slug}" | ${game.title} | ${game.year || "?"} | ${game.genres
          .slice(0, 4)
          .join(", ")} | score=${game.userScore || "?"}`
    )
    .join("\n");

  const systemPrompt = [
    "Eres un curador experto de videojuegos. Recibes el perfil de un usuario y una lista de candidatos.",
    `Selecciona EXACTAMENTE ${TARGET_COUNT} juegos de la lista de candidatos.`,
    "Para cada uno, escribe UNA frase en español (máx. 25 palabras) explicando por qué le gustará,",
    "citando juegos concretos de su biblioteca cuando sea posible (entre **negritas**).",
    "Asigna una afinidad entre 50 y 99 (entero).",
    "",
    "Responde SOLO con JSON válido, sin markdown ni texto extra, con esta forma exacta:",
    '{"recommendations":[{"slug":"...","reason":"...","affinity":85}]}',
    "",
    "Usa solo slugs de la lista de candidatos. No inventes nada."
  ].join("\n");

  const userPrompt = `PERFIL:\n${userBlock}\n\nCANDIDATOS:\n${candidatesBlock}`;

  const startedAt = Date.now();
  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.6,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.warn("groq request failed", { status: response.status, body: body.slice(0, 400) });
      void logLlmCall({
        scope: "recommendations",
        outcome: "error",
        userId: userId ?? null,
        model: DEFAULT_MODEL,
        latencyMs,
        httpStatus: response.status,
        errorCode: `http_${response.status}`
      });
      return deterministicRanking(profile, candidates);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const usage = data.usage ?? {};
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      log.warn("groq returned empty content");
      void logLlmCall({
        scope: "recommendations",
        outcome: "error",
        userId: userId ?? null,
        model: DEFAULT_MODEL,
        latencyMs,
        httpStatus: response.status,
        errorCode: "empty-content",
        tokensIn: usage.prompt_tokens ?? null,
        tokensOut: usage.completion_tokens ?? null
      });
      return deterministicRanking(profile, candidates);
    }

    const parsed = parseLLMResponse(content);
    if (!parsed) {
      void logLlmCall({
        scope: "recommendations",
        outcome: "error",
        userId: userId ?? null,
        model: DEFAULT_MODEL,
        latencyMs,
        httpStatus: response.status,
        errorCode: "invalid-json",
        tokensIn: usage.prompt_tokens ?? null,
        tokensOut: usage.completion_tokens ?? null
      });
      return deterministicRanking(profile, candidates);
    }

    const byslug = new Map(candidates.map((game) => [game.slug, game]));
    const recommendations: Recommendation[] = [];
    for (const item of parsed) {
      const game = byslug.get(item.slug);
      if (!game) continue;
      if (recommendations.some((r) => r.slug === game.slug)) continue;
      recommendations.push({
        slug: game.slug,
        title: game.title,
        coverUrl: game.coverUrl ?? null,
        reason: item.reason,
        affinity: Number.isFinite(item.affinity) ? Math.max(50, Math.min(99, Math.round(item.affinity))) : null,
        year: game.year || null,
        genres: game.genres.slice(0, 3)
      });
      if (recommendations.length >= TARGET_COUNT) break;
    }

    if (recommendations.length === 0) {
      log.warn("llm response had no valid slugs");
      void logLlmCall({
        scope: "recommendations",
        outcome: "error",
        userId: userId ?? null,
        model: DEFAULT_MODEL,
        latencyMs,
        httpStatus: response.status,
        errorCode: "no-valid-slugs",
        tokensIn: usage.prompt_tokens ?? null,
        tokensOut: usage.completion_tokens ?? null
      });
      return deterministicRanking(profile, candidates);
    }

    void logLlmCall({
      scope: "recommendations",
      outcome: "llm",
      userId: userId ?? null,
      model: DEFAULT_MODEL,
      latencyMs,
      httpStatus: response.status,
      tokensIn: usage.prompt_tokens ?? null,
      tokensOut: usage.completion_tokens ?? null
    });

    return recommendations;
  } catch (error) {
    log.warn("llm ranking failed", { error });
    void logLlmCall({
      scope: "recommendations",
      outcome: "error",
      userId: userId ?? null,
      model: DEFAULT_MODEL,
      latencyMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name : "unknown"
    });
    return deterministicRanking(profile, candidates);
  }
}

function parseLLMResponse(content: string): Array<{ slug: string; reason: string; affinity: number }> | null {
  try {
    const parsed = JSON.parse(content) as { recommendations?: unknown };
    if (!parsed || !Array.isArray(parsed.recommendations)) return null;
    const cleaned: Array<{ slug: string; reason: string; affinity: number }> = [];
    for (const item of parsed.recommendations) {
      if (!item || typeof item !== "object") continue;
      const slug = String((item as { slug?: unknown }).slug ?? "").trim();
      const reason = String((item as { reason?: unknown }).reason ?? "").trim();
      const affinity = Number((item as { affinity?: unknown }).affinity ?? 0);
      if (!slug || !reason) continue;
      cleaned.push({ slug, reason: reason.slice(0, 280), affinity });
    }
    return cleaned;
  } catch {
    return null;
  }
}

function deterministicRanking(profile: TasteProfile, candidates: Game[]): Recommendation[] {
  const favoriteGenres = new Set(
    (profile.topGenres.length ? profile.topGenres : profile.fallbackGenres).map((value) => value.toLowerCase())
  );
  const favoritePlatforms = new Set(
    (profile.topPlatforms.length ? profile.topPlatforms : profile.fallbackPlatforms).map((value) => value.toLowerCase())
  );
  const favoriteDevelopers = new Set(profile.topDevelopers.map((value) => value.toLowerCase()));

  const scored = candidates.map((game) => {
    const sharedGenres = game.genres.filter((value) => favoriteGenres.has(value.toLowerCase())).length;
    const sharedPlatforms = game.platforms.filter((value) =>
      favoritePlatforms.has(value.toLowerCase())
    ).length;
    const sameDev = favoriteDevelopers.has((game.developer ?? "").toLowerCase()) ? 1 : 0;
    const affinity = Math.min(
      99,
      55 + sharedGenres * 8 + sharedPlatforms * 3 + sameDev * 6 + game.userScore
    );
    return { game, affinity, sharedGenres };
  });

  scored.sort((a, b) => b.affinity - a.affinity || b.game.userScore - a.game.userScore);

  return scored.slice(0, TARGET_COUNT).map(({ game, affinity, sharedGenres }) => ({
    slug: game.slug,
    title: game.title,
    coverUrl: game.coverUrl ?? null,
    reason: buildDeterministicReason(game, sharedGenres, profile),
    affinity: Math.round(affinity),
    year: game.year || null,
    genres: game.genres.slice(0, 3)
  }));
}

function buildDeterministicReason(game: Game, sharedGenres: number, profile: TasteProfile) {
  const reference = profile.highRatedTitles[0]?.title;
  const genreLabel = game.genres[0];
  if (reference && sharedGenres > 0 && genreLabel) {
    return `Comparte género ${genreLabel} con **${reference}**, que te gustó.`;
  }
  if (genreLabel) {
    return `Encaja con tus géneros favoritos (${genreLabel}) y tiene buena valoración.`;
  }
  return `Título destacado que encaja con tu biblioteca.`;
}

function buildProfileBlock(profile: TasteProfile) {
  const lines: string[] = [];
  if (profile.highRatedTitles.length) {
    lines.push(
      `- Mejor valorados: ${profile.highRatedTitles
        .slice(0, 6)
        .map((row) => `${row.title} (${row.score}/10)`)
        .join(", ")}`
    );
  }
  if (profile.dislikedTitles.length) {
    lines.push(
      `- Bajas notas: ${profile.dislikedTitles.map((row) => `${row.title} (${row.score}/10)`).join(", ")}`
    );
  }
  const genres = profile.topGenres.length ? profile.topGenres : profile.fallbackGenres;
  if (genres.length) lines.push(`- Géneros favoritos: ${genres.slice(0, 5).join(", ")}`);
  const platforms = profile.topPlatforms.length ? profile.topPlatforms : profile.fallbackPlatforms;
  if (platforms.length) lines.push(`- Plataformas: ${platforms.slice(0, 4).join(", ")}`);
  if (profile.topDevelopers.length)
    lines.push(`- Desarrolladoras presentes en su biblioteca: ${profile.topDevelopers.slice(0, 4).join(", ")}`);
  if (!lines.length) lines.push("- Usuario nuevo, sin biblioteca relevante. Sugiere clásicos seguros.");
  return lines.join("\n");
}

async function persistRecommendations(userId: string, recommendations: Recommendation[]) {
  try {
    const sql = createSqlClient();
    await sql.query(`delete from user_recommendations where user_id = $1`, [userId]);

    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      await sql.query(
        `insert into user_recommendations
           (user_id, game_id, reason, affinity_score, position, generated_at, expires_at)
         select $1, g.id, $2, $3, $4, now(), now() + interval '24 hours'
         from games g where g.slug = $5
         on conflict (user_id, game_id) do update
           set reason = excluded.reason,
               affinity_score = excluded.affinity_score,
               position = excluded.position,
               generated_at = excluded.generated_at,
               expires_at = excluded.expires_at`,
        [userId, rec.reason, rec.affinity, i, rec.slug]
      );
    }
  } catch (error) {
    log.warn("failed to persist recommendations", { error });
  }
}

import type { Metadata } from "next";
import { ListExperience } from "@/components/lists/ListExperience";
import {
  COMMUNITY_LIST_MAX_GAMES,
  communityLists,
  type CommunityListGame,
  type CommunityListQuery,
  type CommunityListSeed
} from "@/data/community";
import type { Game } from "@/data/games";
import { getExploreGames } from "@/services/games";
import { fetchIgdbGamesForCuratedList, normalizeIgdbGame } from "@/services/igdb";
import { createServiceDatabaseClient } from "@/services/database";
import { LIST_WITH_ITEMS_SELECT, listFromRow } from "@/services/lists";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const list = await getPublicDatabaseList(slug);
  const fallback = communityLists.find((item) => item.slug === slug);
  return {
    title: list?.title ?? fallback?.title ?? "Lista",
    description: list?.description ?? fallback?.description
  };
}

export default async function ListPage({ params }: { params: Params }) {
  const { slug } = await params;
  const list = await getPublicDatabaseList(slug);

  if (list) return <ListExperience slug={slug} initialList={list} />;

  const fallback = communityLists.find((item) => item.slug === slug);
  if (fallback) {
    const games = await resolveCommunityListGames(fallback);
    return <ListExperience slug={slug} initialList={{
      id: slug,
      slug,
      title: fallback.title,
      description: fallback.description,
      coverUrl: null,
      isPublic: true,
      likesCount: fallback.likes,
      user: { id: "editorial", username: "gameindex", displayName: "GameIndex", bio: null, avatarUrl: null, createdAt: null, favoritePlatforms: [], favoriteGenres: [] },
      items: games.map((game, index) => ({ game, position: index + 1, note: null })),
      createdAt: new Date().toISOString()
    }} />;
  }

  return <ListExperience slug={slug} initialList={null} />;
}

async function resolveCommunityListGames(list: CommunityListSeed): Promise<Game[]> {
  if (list.query) {
    const games = await resolveByQuery(list.query);
    if (games.length) return games.slice(0, COMMUNITY_LIST_MAX_GAMES);
  }

  const seedResults = await Promise.all(
    list.games.map((game) => getExploreGames({ query: getCommunityListGameTitle(game), pageSize: 1 }))
  );
  return seedResults.flatMap((result) => result.games.slice(0, 1));
}

async function resolveByQuery(query: CommunityListQuery): Promise<Game[]> {
  const limit = Math.min(query.pageSize ?? COMMUNITY_LIST_MAX_GAMES, COMMUNITY_LIST_MAX_GAMES);

  try {
    const igdbGames = await fetchIgdbGamesForCuratedList({
      genreName: query.genre,
      upcoming: query.status === "upcoming",
      year: query.year,
      limit
    });

    if (igdbGames.length) {
      return igdbGames.map((game) => igdbGameToGame(normalizeIgdbGame(game))).slice(0, limit);
    }
  } catch {
    // fall through to the generic getExploreGames path
  }

  const accumulated: Game[] = [];
  const seen = new Set<string>();
  let page = 1;
  while (accumulated.length < limit && page <= 10) {
    const result = await getExploreGames({
      page,
      pageSize: limit,
      genre: query.genre,
      status: query.status,
      year: query.year,
      sort: query.sort,
      scoreMin: query.scoreMin
    });

    if (!result.games.length) break;
    for (const game of result.games) {
      const key = game.slug || game.title;
      if (seen.has(key)) continue;
      seen.add(key);
      accumulated.push(game);
      if (accumulated.length >= limit) break;
    }

    if (result.nextPage == null) break;
    page = result.nextPage;
  }

  return accumulated;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1511512578047-dfb367046420??auto=format&fit=crop&w=1200&q=80";

function igdbGameToGame(externalGame: ReturnType<typeof normalizeIgdbGame>): Game {
  const score = externalGame.rating ? Number((externalGame.rating / 10).toFixed(1)) : 0;
  const releaseDate = externalGame.releaseDate ?? "Fecha por anunciar";
  const status = (() => {
    if (!externalGame.releaseDate) return "upcoming" as const;
    const time = new Date(externalGame.releaseDate).getTime();
    if (Number.isNaN(time)) return "released" as const;
    return time > Date.now() ? "upcoming" as const : "released" as const;
  })();

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

function getCommunityListGameTitle(game: CommunityListGame) {
  return typeof game === "string" ? game : game.title;
}

async function getPublicDatabaseList(slug: string) {
  try {
    const serviceClient = createServiceDatabaseClient();
    const { data, error } = await serviceClient
      .from("lists")
      .select(LIST_WITH_ITEMS_SELECT)
      .eq("slug", slug)
      .eq("is_public", true)
      .maybeSingle();

    if (error || !data) return null;
    return listFromRow(data);
  } catch {
    return null;
  }
}

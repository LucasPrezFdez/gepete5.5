import type { Metadata } from "next";
import { ListExperience } from "@/components/lists/ListExperience";
import { communityLists, type CommunityListGame } from "@/data/community";
import { getExploreGames } from "@/services/games";
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
    const gameResults = await Promise.all(
      fallback.games.map((game) => getExploreGames({ query: getCommunityListGameTitle(game), pageSize: 1 }))
    );
    const games = gameResults.flatMap((result) => result.games.slice(0, 1));
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

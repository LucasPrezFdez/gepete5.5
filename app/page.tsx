import { HomeExperience } from "@/components/home/HomeExperience";
import { communityLists, type CommunityListGame, type CommunityListSeed } from "@/data/community";
import { getExploreGames, getHomeCollections } from "@/services/games";

export const revalidate = 600;

export default async function HomePage() {
  const [collections, resolvedCommunityLists] = await Promise.all([
    getHomeCollections(),
    getResolvedCommunityLists()
  ]);

  return <HomeExperience collections={collections} communityLists={resolvedCommunityLists} />;
}

async function getResolvedCommunityLists(): Promise<CommunityListSeed[]> {
  return Promise.all(
    [...communityLists]
      .sort((a, b) => b.likes - a.likes)
      .map(async (list) => ({
        ...list,
        games: await Promise.all(list.games.map(resolveCommunityListGame))
      }))
  );
}

async function resolveCommunityListGame(game: CommunityListGame): Promise<CommunityListGame> {
  const seed = normalizeCommunityListGame(game);
  if (seed.coverUrl) return seed;

  try {
    const result = await getExploreGames({ query: seed.title, pageSize: 1 });
    const match = result.games[0];
    return {
      title: seed.title,
      coverUrl: match?.coverUrl ?? null
    };
  } catch {
    return seed;
  }
}

function normalizeCommunityListGame(game: CommunityListGame) {
  if (typeof game === "string") return { title: game, coverUrl: null };
  return { title: game.title, coverUrl: game.coverUrl ?? null };
}

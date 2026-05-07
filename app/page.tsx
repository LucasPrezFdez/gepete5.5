import { HomeExperience } from "@/components/home/HomeExperience";
import { getExploreGames } from "@/services/games";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const gamesResult = await getExploreGames({ pageSize: 12 });

  return <HomeExperience initialGames={gamesResult.games} />;
}

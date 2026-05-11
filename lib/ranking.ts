import type { Game } from "@/data/games";

export type RankByBayesianOptions = {
  hardMinVotes?: number;
  percentile?: number;
  take?: number;
};

export type RankedGames = {
  games: Game[];
  meanScore: number;
  minVotes: number;
  totalVotes: number;
};

export function rankByBayesian(
  source: Game[],
  { hardMinVotes = 100, percentile = 0.8, take }: RankByBayesianOptions = {}
): RankedGames {
  const eligible = source.filter(
    (game) => game.userScore > 0 && game.ratings >= hardMinVotes
  );

  if (eligible.length === 0) {
    return { games: [], meanScore: 0, minVotes: hardMinVotes, totalVotes: 0 };
  }

  const meanScore =
    eligible.reduce((sum, game) => sum + game.userScore, 0) / eligible.length;

  const sortedByVotes = eligible.map((g) => g.ratings).sort((a, b) => a - b);
  const percentileIndex = Math.floor(sortedByVotes.length * percentile);
  const minVotes = Math.max(sortedByVotes[percentileIndex] ?? 0, hardMinVotes);

  const score = (game: Game) => {
    const v = game.ratings;
    const r = game.userScore;
    return (v / (v + minVotes)) * r + (minVotes / (v + minVotes)) * meanScore;
  };

  const sorted = eligible
    .map((game) => ({ game, score: score(game) }))
    .sort((a, b) => b.score - a.score || b.game.ratings - a.game.ratings)
    .map((entry) => entry.game);

  const games = typeof take === "number" ? sorted.slice(0, take) : sorted;
  const totalVotes = games.reduce((sum, g) => sum + g.ratings, 0);

  return { games, meanScore, minVotes, totalVotes };
}

export function dedupeBySlug(lists: Array<{ games: Game[] }>): Game[] {
  const seen = new Set<string>();
  const merged: Game[] = [];
  for (const list of lists) {
    for (const game of list.games) {
      if (seen.has(game.slug)) continue;
      seen.add(game.slug);
      merged.push(game);
    }
  }
  return merged;
}

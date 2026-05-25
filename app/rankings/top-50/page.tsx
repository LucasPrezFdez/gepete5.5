import type { Metadata } from "next";
import { RankingPageHeader } from "@/components/rankings/RankingPageHeader";
import { RankingTable } from "@/components/rankings/RankingTable";
import { getExploreGames } from "@/services/games";
import { formatCompactNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top 50 videojuegos",
  description: "Ranking de los 50 mejores videojuegos según la API configurada."
};

const TARGET_COUNT = 50;
const PAGE_SIZE = 50;
// Fetch extra pages so the Bayesian filter still leaves >= TARGET_COUNT candidates.
const PAGES_TO_FETCH = 5;

export default async function Top50Page() {
  const pageResults = await Promise.all(
    Array.from({ length: PAGES_TO_FETCH }, (_, index) =>
      getExploreGames({ pageSize: PAGE_SIZE, page: index + 1, sort: "score" })
    )
  );

  const seen = new Set<string>();
  const merged = [] as (typeof pageResults)[number]["games"];
  for (const result of pageResults) {
    for (const game of result.games) {
      if (seen.has(game.slug)) continue;
      seen.add(game.slug);
      merged.push(game);
    }
  }

  const withScore = merged.filter((game) => game.userScore > 0);

  // Start with a soft minimum and relax it until we have enough candidates to fill TARGET_COUNT.
  const VOTE_THRESHOLDS = [100, 50, 20, 10, 5, 1, 0];
  let eligible = withScore;
  for (const threshold of VOTE_THRESHOLDS) {
    const filtered = withScore.filter((game) => game.ratings >= threshold);
    if (filtered.length >= TARGET_COUNT) {
      eligible = filtered;
      break;
    }
    eligible = filtered;
  }

  const meanScore =
    eligible.reduce((sum, game) => sum + game.userScore, 0) /
    (eligible.length || 1);

  const sortedByVotes = eligible.map((game) => game.ratings).sort((a, b) => a - b);
  const percentileIndex = Math.floor(sortedByVotes.length * 0.8);
  const minVotes = Math.max(sortedByVotes[percentileIndex] ?? 0, 1);

  const bayesianScore = (game: (typeof eligible)[number]) => {
    const v = game.ratings;
    const r = game.userScore;
    return (v / (v + minVotes)) * r + (minVotes / (v + minVotes)) * meanScore;
  };

  const ranked = eligible
    .map((game) => ({ game, score: bayesianScore(game) }))
    .sort((a, b) => b.score - a.score || b.game.ratings - a.game.ratings)
    .slice(0, TARGET_COUNT)
    .map((entry) => entry.game);

  const primary = pageResults[0];
  const errors = pageResults.map((result) => result.error).filter(Boolean) as string[];
  const totalVotes = ranked.reduce((sum, g) => sum + g.ratings, 0);
  const avgScore =
    ranked.reduce((sum, g) => sum + g.userScore, 0) / Math.max(1, ranked.length);
  const sourceLabel =
    primary.source === "none" ? "API configurada" : primary.source.toUpperCase();

  return (
    <section className="container-page space-y-6 py-10">
      <RankingPageHeader
        eyebrow="Ranking principal"
        title="Los 50 mejores videojuegos"
        highlightWord="50"
        description="Media bayesiana sobre el catálogo completo con umbral dinámico de votos. El ranking principal de GameIndex."
        accent="electric"
        stats={[
          { label: "Mostrando", value: `${ranked.length} / ${TARGET_COUNT}` },
          {
            label: "Nota media",
            value: avgScore ? avgScore.toFixed(1) : "—",
            accent: true
          },
          { label: "Votos totales", value: formatCompactNumber(totalVotes) },
          { label: "Fuente", value: sourceLabel }
        ]}
      />

      {errors.length > 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
          {errors.join(" ")}
        </p>
      )}

      <RankingTable games={ranked} />
    </section>
  );
}

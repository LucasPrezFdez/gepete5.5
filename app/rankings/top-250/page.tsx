import type { Metadata } from "next";
import { RankingTable } from "@/components/rankings/RankingTable";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { getExploreGames } from "@/services/games";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top 250 videojuegos",
  description: "Ranking de los 250 mejores videojuegos según la API configurada."
};

const TARGET_COUNT = 250;
const PAGE_SIZE = 50;
const PAGES_TO_FETCH = Math.ceil(TARGET_COUNT / PAGE_SIZE);

export default async function Top250Page() {
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

  const scored = merged.filter((game) => game.userScore > 0 && game.ratings > 0);

  const meanScore =
    scored.reduce((sum, game) => sum + game.userScore, 0) / (scored.length || 1);

  const sortedByVotes = scored.map((game) => game.ratings).sort((a, b) => a - b);
  const percentileIndex = Math.floor(sortedByVotes.length * 0.6);
  const minVotes = sortedByVotes[percentileIndex] ?? 0;

  const bayesianScore = (game: (typeof scored)[number]) => {
    const v = game.ratings;
    const r = game.userScore;
    return (v / (v + minVotes)) * r + (minVotes / (v + minVotes)) * meanScore;
  };

  const ranked = scored
    .map((game) => ({ game, score: bayesianScore(game) }))
    .sort((a, b) => b.score - a.score || b.game.ratings - a.game.ratings)
    .slice(0, TARGET_COUNT)
    .map((entry) => entry.game);

  const primary = pageResults[0];
  const errors = pageResults.map((result) => result.error).filter(Boolean) as string[];

  return (
    <section className="container-page py-10">
      <SectionHeader eyebrow="Ranking API" title="Los 250 mejores videojuegos según la API" />
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-muted">
        Mostrando {ranked.length} de {TARGET_COUNT} · Datos cargados desde{" "}
        {primary.source === "none" ? "la API configurada" : primary.source.toUpperCase()}.
        {errors.length > 0 ? ` ${errors.join(" ")}` : ""}
      </div>
      <RankingTable games={ranked} />
    </section>
  );
}

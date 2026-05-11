import type { Metadata } from "next";
import { RankingPageHeader } from "@/components/rankings/RankingPageHeader";
import { RankingTable } from "@/components/rankings/RankingTable";
import { getExploreGames } from "@/services/games";
import type { Game } from "@/data/games";
import { formatCompactNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const PAGES_TO_FETCH = 4;
const TARGET_COUNT = 100;
const HARD_MIN_REVIEWS = 5;

export const metadata: Metadata = {
  title: "Los más comentados",
  description: "Los videojuegos con más reseñas y conversación activa en la comunidad."
};

export default async function ReviewedRankingPage() {
  const pageResults = await Promise.all(
    Array.from({ length: PAGES_TO_FETCH }, (_, index) =>
      getExploreGames({ pageSize: PAGE_SIZE, page: index + 1, sort: "reviewed" })
    )
  );

  const seen = new Set<string>();
  const merged = [] as Game[];
  for (const result of pageResults) {
    for (const game of result.games) {
      if (seen.has(game.slug)) continue;
      seen.add(game.slug);
      merged.push(game);
    }
  }

  const eligible = merged.filter((game) => game.reviews >= HARD_MIN_REVIEWS);

  const ranked = eligible
    .slice()
    .sort(
      (a, b) =>
        b.reviews - a.reviews ||
        b.ratings - a.ratings ||
        b.userScore - a.userScore
    )
    .slice(0, TARGET_COUNT);

  const totalReviews = ranked.reduce((sum, g) => sum + g.reviews, 0);
  const avgScore =
    ranked.reduce((sum, g) => sum + g.userScore, 0) /
    Math.max(1, ranked.length);
  const errors = pageResults.map((r) => r.error).filter(Boolean) as string[];

  return (
    <section className="container-page space-y-6 py-10">
      <RankingPageHeader
        eyebrow="Comunidad activa"
        title="Los más comentados"
        highlightWord="comentados"
        description="Ranking de los videojuegos con más actividad de reseñas. Donde la comunidad debate, recomienda y comparte."
        accent="danger"
        stats={[
          { label: "Juegos rankeados", value: String(ranked.length) },
          {
            label: "Nota media",
            value: avgScore ? avgScore.toFixed(1) : "—",
            accent: true
          },
          { label: "Reseñas totales", value: formatCompactNumber(totalReviews) }
        ]}
      />

      {errors.length > 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
          {errors.join(" ")}
        </p>
      )}

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted">
          Aún no hay suficientes juegos con ≥{HARD_MIN_REVIEWS} reseñas. Anima a
          la comunidad escribiendo la tuya.
        </div>
      ) : (
        <RankingTable games={ranked} />
      )}
    </section>
  );
}

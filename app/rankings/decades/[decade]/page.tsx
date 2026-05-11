import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingPageHeader } from "@/components/rankings/RankingPageHeader";
import { RankingTable } from "@/components/rankings/RankingTable";
import { getExploreGames } from "@/services/games";
import { formatCompactNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Accent = "electric" | "violet" | "lime" | "danger";

const DECADES: Record<
  string,
  { label: string; from: number; to: number; accent: Accent; description: string }
> = {
  "2020s": {
    label: "2020s",
    from: 2020,
    to: 2029,
    accent: "electric",
    description:
      "Lo más destacado de la década actual: nuevos lanzamientos, remakes definitivos y juegos que están redefiniendo el medio."
  },
  "2010s": {
    label: "2010s",
    from: 2010,
    to: 2019,
    accent: "violet",
    description:
      "La década dorada de los videojuegos modernos: open worlds, indies que sacudieron la industria y franquicias en plenitud."
  },
  "2000s": {
    label: "2000s",
    from: 2000,
    to: 2009,
    accent: "lime",
    description:
      "El salto generacional al 3D maduro, los shooters que definieron la era y los JRPGs eternos."
  },
  "90s": {
    label: "90s",
    from: 1990,
    to: 1999,
    accent: "danger",
    description:
      "Los pilares del medio: pixel art, primeros 3D, plataformas legendarias y la edad de oro del PC gaming."
  }
};

const PAGE_SIZE = 50;
const PAGES_TO_FETCH = 8;
const TARGET_COUNT = 100;
const HARD_MIN_VOTES = 30;

type Params = Promise<{ decade: string }>;

export async function generateStaticParams() {
  return Object.keys(DECADES).map((decade) => ({ decade }));
}

export async function generateMetadata({
  params
}: {
  params: Params;
}): Promise<Metadata> {
  const { decade } = await params;
  const info = DECADES[decade];
  if (!info) return { title: "Ranking de década" };
  const title = `Mejores videojuegos de los ${info.label}`;
  const description = `Los mejores videojuegos lanzados entre ${info.from} y ${info.to} según la comunidad.`;
  return {
    title,
    description,
    alternates: { canonical: `/rankings/decades/${decade}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description }
  };
}

export default async function DecadeRankingPage({ params }: { params: Params }) {
  const { decade } = await params;
  const info = DECADES[decade];
  if (!info) notFound();

  const pageResults = await Promise.all(
    Array.from({ length: PAGES_TO_FETCH }, (_, index) =>
      getExploreGames({ pageSize: PAGE_SIZE, page: index + 1, sort: "score" })
    )
  );

  const seen = new Set<string>();
  const inDecade = [] as (typeof pageResults)[number]["games"];
  for (const result of pageResults) {
    for (const game of result.games) {
      if (seen.has(game.slug)) continue;
      seen.add(game.slug);
      if (game.year >= info.from && game.year <= info.to) inDecade.push(game);
    }
  }

  const eligible = inDecade.filter(
    (game) => game.userScore > 0 && game.ratings >= HARD_MIN_VOTES
  );

  const meanScore =
    eligible.reduce((sum, game) => sum + game.userScore, 0) /
    Math.max(1, eligible.length);

  const sortedVotes = eligible.map((g) => g.ratings).sort((a, b) => a - b);
  const percentileIndex = Math.floor(sortedVotes.length * 0.7);
  const minVotes = Math.max(sortedVotes[percentileIndex] ?? 0, HARD_MIN_VOTES);

  const bayesian = (g: (typeof eligible)[number]) => {
    const v = g.ratings;
    const r = g.userScore;
    return (v / (v + minVotes)) * r + (minVotes / (v + minVotes)) * meanScore;
  };

  const ranked = eligible
    .map((g) => ({ game: g, score: bayesian(g) }))
    .sort((a, b) => b.score - a.score || b.game.ratings - a.game.ratings)
    .slice(0, TARGET_COUNT)
    .map((entry) => entry.game);

  const totalVotes = ranked.reduce((sum, g) => sum + g.ratings, 0);
  const avgScore =
    ranked.reduce((sum, g) => sum + g.userScore, 0) / Math.max(1, ranked.length);
  const errors = pageResults.map((r) => r.error).filter(Boolean) as string[];

  return (
    <section className="container-page space-y-6 py-10">
      <RankingPageHeader
        eyebrow={`Década ${info.from}–${info.to}`}
        title={`Lo mejor de los ${info.label}`}
        highlightWord={info.label}
        description={info.description}
        accent={info.accent}
        stats={[
          { label: "Juegos rankeados", value: String(ranked.length) },
          {
            label: "Nota media",
            value: avgScore ? avgScore.toFixed(1) : "—",
            accent: true
          },
          { label: "Votos totales", value: formatCompactNumber(totalVotes) },
          { label: "Mínimo votos", value: formatCompactNumber(minVotes) }
        ]}
      />

      <DecadeNav active={decade} />

      {errors.length > 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
          {errors.join(" ")}
        </p>
      )}

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted">
          Aún no hay juegos suficientes con ≥{HARD_MIN_VOTES} votos en esta
          década. Vuelve más tarde cuando el catálogo esté más poblado.
        </div>
      ) : (
        <RankingTable games={ranked} />
      )}
    </section>
  );
}

function DecadeNav({ active }: { active: string }) {
  return (
    <nav
      className="flex flex-wrap gap-2"
      aria-label="Cambiar de década"
    >
      {Object.entries(DECADES).map(([key, info]) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={`/rankings/decades/${key}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-xl border border-electric bg-electric/15 px-4 py-2 text-sm font-bold text-electric"
                : "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-muted transition hover:border-white/25 hover:text-foreground"
            }
          >
            {info.label}
          </Link>
        );
      })}
    </nav>
  );
}

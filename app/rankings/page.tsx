import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { getExploreGames } from "@/services/games";
import { formatCompactNumber } from "@/lib/utils";
import { dedupeBySlug, rankByBayesian } from "@/lib/ranking";
import { RankingCard } from "@/components/rankings/RankingCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankings",
  description: "Rankings de videojuegos por nota, plataforma, género, década y popularidad."
};

const FEATURED_PLATFORMS = [
  {
    name: "PC",
    slug: "pc",
    tone: "border-electric/45 bg-electric/15 text-blue-100 hover:bg-electric/25"
  },
  {
    name: "PlayStation 5",
    slug: "playstation-5",
    tone: "border-violet/45 bg-violet/15 text-violet-100 hover:bg-violet/25"
  },
  {
    name: "Xbox Series X|S",
    slug: "xbox-series-x",
    tone: "border-lime/45 bg-lime/15 text-lime hover:bg-lime/25"
  },
  {
    name: "Nintendo Switch",
    slug: "nintendo-switch",
    tone: "border-danger/45 bg-danger/15 text-red-100 hover:bg-danger/25"
  }
];

const FEATURED_GENRES = [
  { name: "RPG", slug: "rpg" },
  { name: "Acción", slug: "action" },
  { name: "Aventura", slug: "adventure" },
  { name: "Shooter", slug: "shooter" },
  { name: "Indie", slug: "indie" },
  { name: "Estrategia", slug: "strategy" },
  { name: "Puzzle", slug: "puzzle" },
  { name: "Deportes", slug: "sports" }
];

const DECADES = [
  { label: "2020s", slug: "2020s", year: 2024 },
  { label: "2010s", slug: "2010s", year: 2015 },
  { label: "2000s", slug: "2000s", year: 2005 },
  { label: "90s", slug: "90s", year: 1995 }
];

const POOL_PAGE_SIZE = 50;
const POOL_PAGES = 3;

export default async function RankingsPage() {
  const [poolResults, upcoming, reviewed] = await Promise.all([
    Promise.all(
      Array.from({ length: POOL_PAGES }, (_, index) =>
        getExploreGames({
          pageSize: POOL_PAGE_SIZE,
          page: index + 1,
          sort: "score"
        })
      )
    ),
    getExploreGames({ pageSize: 6, sort: "upcoming", status: "upcoming" }),
    getExploreGames({ pageSize: 5, sort: "reviewed" })
  ]);

  const pool = dedupeBySlug(poolResults);
  const ranked = rankByBayesian(pool, { hardMinVotes: 100, percentile: 0.8 });

  const podium = ranked.games.slice(0, 3);
  const topFive = ranked.games.slice(0, 5);
  const upcomingPreview = upcoming.games.slice(0, 3);
  const reviewedPreview = reviewed.games.slice(0, 3);

  const totalGames = poolResults[0]?.count ?? pool.length;
  const averageScore = ranked.meanScore;
  const totalVotes = ranked.totalVotes;

  return (
    <section className="container-page space-y-12 py-10">
      <RankingsHero
        podium={podium}
        totalGames={totalGames}
        averageScore={averageScore}
        totalVotes={totalVotes}
      />

      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">
              Explora todos los rankings
            </p>
            <h2 className="text-2xl font-black md:text-3xl">
              Encuentra tu próximo juego favorito
            </h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6 lg:grid-rows-[auto_auto]">
          <TopRankingCard topFive={topFive} totalGames={totalGames} />
          <PlatformsCard />
          <GenresCard />
          <DecadesCard />
          <UpcomingCard games={upcomingPreview} count={upcoming.count} />
          <ReviewedCard games={reviewedPreview} />
        </div>
      </div>
    </section>
  );
}

function RankingsHero({
  podium,
  totalGames,
  averageScore,
  totalVotes
}: {
  podium: Awaited<ReturnType<typeof getExploreGames>>["games"];
  totalGames: number;
  averageScore: number;
  totalVotes: number;
}) {
  const [first, second, third] = podium;

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-surface/80 shadow-card backdrop-blur">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-electric/15 via-violet/10 to-transparent" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-electric/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-72 w-72 rounded-full bg-violet/25 blur-3xl" />

      <div className="relative grid gap-10 p-8 md:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="space-y-6">
          <Badge tone="blue" className="uppercase tracking-[0.3em]">
            ★ Ranking destacado
          </Badge>
          <div className="space-y-3">
            <h1 className="text-balance text-3xl font-black leading-tight md:text-5xl">
              Los <span className="text-electric">rankings</span> más completos
              del catálogo
            </h1>
            <p className="max-w-xl text-sm leading-7 text-muted md:text-base">
              Listas curadas con media ponderada bayesiana, mínimo de votos y
              actualización continua. Sin sesgos por pocas valoraciones, solo
              los juegos que la comunidad respalda.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/rankings/top-50"
              className="group inline-flex items-center gap-2 rounded-xl bg-electric px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-blue-500"
            >
              Ver Top 50
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href="/games?sort=popular"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:border-electric/45 hover:bg-white/10"
            >
              Explorar catálogo
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            <HeroStat
              label="Juegos rankeados"
              value={formatCompactNumber(totalGames)}
            />
            <HeroStat
              label="Nota media"
              value={averageScore ? averageScore.toFixed(1) : "—"}
              accent
            />
            <HeroStat
              label="Votos totales"
              value={formatCompactNumber(totalVotes)}
            />
          </div>
        </div>

        <div className="relative">
          {podium.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-muted">
              Cargando los mejores juegos…
            </div>
          ) : (
            <div className="grid grid-cols-3 items-end gap-3 md:gap-4">
              {second && <PodiumSlot game={second} rank={2} />}
              {first && <PodiumSlot game={first} rank={1} highlight />}
              {third && <PodiumSlot game={third} rank={3} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-2xl font-black tabular-nums md:text-3xl ${
          accent ? "text-lime" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function PodiumSlot({
  game,
  rank,
  highlight = false
}: {
  game: Awaited<ReturnType<typeof getExploreGames>>["games"][number];
  rank: 1 | 2 | 3;
  highlight?: boolean;
}) {
  const ringTone =
    rank === 1
      ? "from-lime/70 via-electric/40 to-violet/40 shadow-glow"
      : rank === 2
        ? "from-electric/55 via-electric/20 to-transparent"
        : "from-violet/55 via-violet/20 to-transparent";
  const medalTone =
    rank === 1
      ? "bg-lime text-background"
      : rank === 2
        ? "bg-electric text-white"
        : "bg-violet text-white";
  const heightClass = highlight
    ? "aspect-[3/4]"
    : "aspect-[3/4] mt-6 md:mt-10";

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative z-10 flex flex-col items-center"
    >
      <div className={`relative w-full ${heightClass}`}>
        <div
          className={`pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br ${ringTone} opacity-60 blur-md transition group-hover:opacity-100`}
        />
        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {game.coverUrl ? (
            <Image
              src={game.coverUrl}
              alt={`Cover de ${game.title}`}
              fill
              sizes="(max-width: 768px) 33vw, 180px"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs uppercase text-muted">
              Sin cover
            </div>
          )}
          <div
            className={`absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-black tabular-nums ${medalTone}`}
          >
            #{rank}
          </div>
          <div className="absolute right-2 top-2">
            <RatingBadge score={game.userScore} compact />
          </div>
        </div>
      </div>
      <div className="mt-3 w-full text-center">
        <p className="line-clamp-1 text-sm font-semibold group-hover:text-electric md:text-base">
          {game.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[11px] uppercase tracking-wider text-muted">
          {game.year || "—"} · {game.genres[0] ?? "Sin género"}
        </p>
      </div>
    </Link>
  );
}

function TopRankingCard({
  topFive,
  totalGames
}: {
  topFive: Awaited<ReturnType<typeof getExploreGames>>["games"];
  totalGames: number;
}) {
  return (
    <RankingCard
      href="/rankings/top-50"
      eyebrow="Ranking principal"
      title="Top 50 videojuegos"
      description={`Media bayesiana sobre ${formatCompactNumber(totalGames)} juegos. El ranking que sirve de brújula.`}
      accent="electric"
      className="lg:col-span-3 lg:row-span-2"
    >
      <ol className="space-y-2">
        {topFive.length === 0 ? (
          <li className="text-sm text-muted">Sin datos disponibles.</li>
        ) : (
          topFive.map((game, index) => (
            <li key={game.slug}>
              <Link
                href={`/games/${game.slug}`}
                className="flex items-center gap-3 rounded-xl border border-transparent bg-white/[0.03] px-3 py-2 transition hover:border-electric/45 hover:bg-electric/5"
              >
                <span className="w-6 text-sm font-black tabular-nums text-muted">
                  {index + 1}
                </span>
                <span className="relative h-12 w-9 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                  {game.coverUrl && (
                    <Image
                      src={game.coverUrl}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {game.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {game.year || "—"} · {formatCompactNumber(game.ratings)} votos
                  </span>
                </span>
                <RatingBadge score={game.userScore} compact />
              </Link>
            </li>
          ))
        )}
      </ol>
    </RankingCard>
  );
}

function PlatformsCard() {
  return (
    <RankingCard
      href="/platforms/pc"
      eyebrow="Por plataforma"
      title="Mejores por plataforma"
      description="Lo más alto en cada catálogo: PC, consolas y portátiles."
      accent="violet"
      className="lg:col-span-3"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FEATURED_PLATFORMS.map((platform) => (
          <Link
            key={platform.slug}
            href={`/platforms/${platform.slug}`}
            className={`flex items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${platform.tone}`}
          >
            {platform.name}
          </Link>
        ))}
      </div>
    </RankingCard>
  );
}

function GenresCard() {
  return (
    <RankingCard
      href="/genres/rpg"
      eyebrow="Por género"
      title="Top por género"
      description="Desde RPG hasta indies — un ranking por cada estilo de juego."
      accent="lime"
      className="lg:col-span-3"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FEATURED_GENRES.map((genre) => (
          <Link
            key={genre.slug}
            href={`/genres/${genre.slug}`}
            className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-foreground transition hover:border-lime/45 hover:bg-lime/10 hover:text-lime"
          >
            {genre.name}
          </Link>
        ))}
      </div>
    </RankingCard>
  );
}

function DecadesCard() {
  return (
    <RankingCard
      href="/rankings/decades/2020s"
      eyebrow="Por década"
      title="Cápsulas del tiempo"
      description="Los mejores juegos de cada era del videojuego."
      accent="violet"
      className="lg:col-span-2"
    >
      <div className="grid grid-cols-2 gap-2">
        {DECADES.map((decade) => (
          <Link
            key={decade.slug}
            href={`/rankings/decades/${decade.slug}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:border-violet/45 hover:bg-violet/10"
          >
            <p className="text-lg font-black text-foreground">{decade.label}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              Desde {decade.year}
            </p>
          </Link>
        ))}
      </div>
    </RankingCard>
  );
}

function UpcomingCard({
  games,
  count
}: {
  games: Awaited<ReturnType<typeof getExploreGames>>["games"];
  count: number;
}) {
  return (
    <RankingCard
      href="/rankings/upcoming"
      eyebrow="Más esperados"
      title="Próximos lanzamientos"
      description={`${formatCompactNumber(count || games.length)} juegos en el horizonte.`}
      accent="lime"
      className="lg:col-span-2"
    >
      <ul className="space-y-2">
        {games.length === 0 ? (
          <li className="text-sm text-muted">Sin próximos lanzamientos.</li>
        ) : (
          games.map((game) => (
            <li
              key={game.slug}
              className="flex items-center gap-2 text-sm text-muted"
            >
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-lime" />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {game.title}
              </span>
              <span className="text-xs tabular-nums">
                {game.year || "TBA"}
              </span>
            </li>
          ))
        )}
      </ul>
    </RankingCard>
  );
}

function ReviewedCard({
  games
}: {
  games: Awaited<ReturnType<typeof getExploreGames>>["games"];
}) {
  return (
    <RankingCard
      href="/rankings/reviewed"
      eyebrow="Reseñas recientes"
      title="Lo más comentado"
      description="Los juegos con más actividad de la comunidad ahora mismo."
      accent="danger"
      className="lg:col-span-2"
    >
      <ul className="space-y-2">
        {games.length === 0 ? (
          <li className="text-sm text-muted">Sin reseñas recientes.</li>
        ) : (
          games.map((game) => (
            <li
              key={game.slug}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-foreground">
                {game.title}
              </span>
              <span className="text-xs tabular-nums text-muted">
                {formatCompactNumber(game.reviews)} reseñas
              </span>
            </li>
          ))
        )}
      </ul>
    </RankingCard>
  );
}

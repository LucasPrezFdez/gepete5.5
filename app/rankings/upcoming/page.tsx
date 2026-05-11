import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { RankingPageHeader } from "@/components/rankings/RankingPageHeader";
import { getExploreGames } from "@/services/games";
import type { Game } from "@/data/games";
import { formatCompactNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const PAGES_TO_FETCH = 3;
const TARGET_COUNT = 60;

export const metadata: Metadata = {
  title: "Más esperados",
  description: "Los próximos videojuegos con más expectación de la comunidad."
};

type Bucket = {
  key: string;
  label: string;
  games: Game[];
};

function parseReleaseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bucketLabel(date: Date | null, year: number) {
  if (!date) return year > 0 ? String(year) : "Sin fecha";
  const now = new Date();
  const monthsAhead =
    (date.getFullYear() - now.getFullYear()) * 12 +
    (date.getMonth() - now.getMonth());
  if (monthsAhead < 0) return year > 0 ? String(year) : "Sin fecha";
  if (monthsAhead === 0) return "Este mes";
  if (monthsAhead <= 3) return "Próximos 3 meses";
  if (monthsAhead <= 6) return "Próximos 6 meses";
  if (date.getFullYear() === now.getFullYear()) return String(date.getFullYear());
  return String(date.getFullYear());
}

const BUCKET_ORDER = [
  "Este mes",
  "Próximos 3 meses",
  "Próximos 6 meses"
];

function compareBuckets(a: string, b: string) {
  const aIndex = BUCKET_ORDER.indexOf(a);
  const bIndex = BUCKET_ORDER.indexOf(b);
  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
  if (aIndex >= 0) return -1;
  if (bIndex >= 0) return 1;
  const aYear = Number(a);
  const bYear = Number(b);
  if (Number.isFinite(aYear) && Number.isFinite(bYear)) return aYear - bYear;
  if (a === "Sin fecha") return 1;
  if (b === "Sin fecha") return -1;
  return a.localeCompare(b);
}

function daysUntil(date: Date | null) {
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  if (diff < 0) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatReleaseDate(value: string | undefined, year: number) {
  const date = parseReleaseDate(value);
  if (!date) return year > 0 ? String(year) : "Por anunciar";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export default async function UpcomingRankingPage() {
  const pageResults = await Promise.all(
    Array.from({ length: PAGES_TO_FETCH }, (_, index) =>
      getExploreGames({
        status: "upcoming",
        sort: "upcoming",
        pageSize: PAGE_SIZE,
        page: index + 1
      })
    )
  );

  const seen = new Set<string>();
  const upcoming = [] as Game[];
  for (const result of pageResults) {
    for (const game of result.games) {
      if (seen.has(game.slug)) continue;
      seen.add(game.slug);
      upcoming.push(game);
    }
  }

  const today = new Date();
  const filtered = upcoming.filter((game) => {
    const date = parseReleaseDate(game.releaseDate);
    if (date && date.getTime() < today.getTime()) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const aDate = parseReleaseDate(a.releaseDate);
    const bDate = parseReleaseDate(b.releaseDate);
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return (a.year || 9999) - (b.year || 9999);
  });

  const ranked = filtered.slice(0, TARGET_COUNT);

  const bucketMap = new Map<string, Game[]>();
  for (const game of ranked) {
    const label = bucketLabel(parseReleaseDate(game.releaseDate), game.year);
    const list = bucketMap.get(label) ?? [];
    list.push(game);
    bucketMap.set(label, list);
  }

  const buckets: Bucket[] = Array.from(bucketMap.entries())
    .map(([key, games]) => ({ key, label: key, games }))
    .sort((a, b) => compareBuckets(a.key, b.key));

  const errors = pageResults.map((r) => r.error).filter(Boolean) as string[];
  const totalCount = pageResults[0]?.count ?? ranked.length;
  const nextGame = ranked[0];
  const nextDate = parseReleaseDate(nextGame?.releaseDate);
  const daysToNext = daysUntil(nextDate);

  return (
    <section className="container-page space-y-6 py-10">
      <RankingPageHeader
        eyebrow="Más esperados"
        title="Próximos lanzamientos"
        highlightWord="lanzamientos"
        description="Los videojuegos que vienen en camino, ordenados por fecha de salida. Marca tus favoritos y planifica tu backlog."
        accent="lime"
        stats={[
          { label: "En el horizonte", value: formatCompactNumber(totalCount) },
          {
            label: "Próximo lanzamiento",
            value: daysToNext !== null ? `${daysToNext} días` : "—",
            accent: true
          },
          { label: "Mostrando", value: String(ranked.length) }
        ]}
      />

      {errors.length > 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
          {errors.join(" ")}
        </p>
      )}

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted">
          No hay próximos lanzamientos en este momento.
        </div>
      ) : (
        <div className="space-y-10">
          {buckets.map((bucket) => (
            <UpcomingBucket key={bucket.key} bucket={bucket} />
          ))}
        </div>
      )}
    </section>
  );
}

function UpcomingBucket({ bucket }: { bucket: Bucket }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-lime" />
        <h2 className="text-lg font-black uppercase tracking-[0.2em] md:text-xl">
          {bucket.label}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-muted">
          {bucket.games.length}
        </span>
        <div className="ml-2 h-px flex-1 bg-white/10" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bucket.games.map((game) => (
          <UpcomingCard key={game.slug} game={game} />
        ))}
      </div>
    </div>
  );
}

function UpcomingCard({ game }: { game: Game }) {
  const releaseLabel = formatReleaseDate(game.releaseDate, game.year);
  const date = parseReleaseDate(game.releaseDate);
  const days = daysUntil(date);

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group flex gap-4 overflow-hidden rounded-2xl border border-white/10 bg-surface/85 p-3 shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:border-lime/45"
    >
      <div className="relative aspect-[3/4] w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {game.coverUrl ? (
          <Image
            src={game.coverUrl}
            alt={`Cover de ${game.title}`}
            fill
            sizes="80px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs uppercase text-muted">
            Sin cover
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-bold leading-tight group-hover:text-lime md:text-base">
            {game.title}
          </h3>
          {days !== null && days <= 30 && (
            <Badge tone="lime" className="flex-shrink-0">
              {days === 0 ? "Hoy" : `${days}d`}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">{releaseLabel}</p>
        <p className="mt-1 line-clamp-1 text-xs text-muted">
          {game.platforms.slice(0, 3).join(", ") || "Plataformas por confirmar"}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {game.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

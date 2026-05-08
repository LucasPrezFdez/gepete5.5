import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/EmptyState";
import { FilterSidebar } from "@/components/games/FilterSidebar";
import { GameGrid } from "@/components/games/GameGrid";
import { GameSearchBar } from "@/components/games/GameSearchBar";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { GameSort } from "@/data/games";
import { getExploreGames } from "@/services/games";

export const revalidate = 300;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Explorar videojuegos",
  description: "Busca videojuegos por plataforma, género, año, desarrolladora, modo de juego, puntuación y estado."
};

export default async function GamesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getSingleParam(params.q ?? params.search);
  const page = getPositivePage(getSingleParam(params.page));
  const platform = getSingleParam(params.platform);
  const genre = getSingleParam(params.genre);
  const status = getSingleParam(params.status);
  const year = getOptionalNumber(getSingleParam(params.year));
  const scoreMin = getOptionalNumber(getSingleParam(params.scoreMin));
  const sort = getSort(getSingleParam(params.sort));
  const view = getSingleParam(params.view) === "list" ? "list" : "grid";
  const gamesResult = await getExploreGames({ query, page, platform, genre, status, year, scoreMin, sort });
  const firstResult = gamesResult.count === 0 ? 0 : (gamesResult.page - 1) * gamesResult.pageSize + 1;
  const lastResult = Math.min(gamesResult.page * gamesResult.pageSize, gamesResult.count);
  const activeFilters = [platform, genre, status, year, scoreMin].filter(Boolean);

  return (
    <section className="container-page py-10">
      <SectionHeader eyebrow="Búsqueda avanzada" title={query ? `Resultados para “${query}”` : "Explora el catálogo de GameIndex"} />
      <div className="mb-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div />
        <GameSearchBar />
      </div>
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="surface-card h-fit rounded-2xl p-5">
          <FilterSidebar />
        </div>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm text-muted">
                {gamesResult.count.toLocaleString("es-ES")} videojuegos
                {gamesResult.count > 0 ? ` · mostrando ${firstResult.toLocaleString("es-ES")}-${lastResult.toLocaleString("es-ES")}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={gamesResult.source} />
                {gamesResult.source === "igdb" && <SourceLink href="https://api-docs.igdb.com/" label="Fuente: IGDB" />}
                {gamesResult.source === "rawg" && <SourceLink href="https://rawg.io/apidocs" label="Fuente: RAWG" />}
                {activeFilters.map((filter) => (
                  <Badge key={String(filter)} tone="violet">{String(filter)}</Badge>
                ))}
              </div>
              {gamesResult.error && <p className="text-xs text-danger">{gamesResult.error}</p>}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
              <Button asChild href={buildGamesUrl(params, { view: "grid", page: undefined })} size="sm" variant={view === "grid" ? "primary" : "ghost"}>
                Grid
              </Button>
              <Button asChild href={buildGamesUrl(params, { view: "list", page: undefined })} size="sm" variant={view === "list" ? "primary" : "ghost"}>
                Lista
              </Button>
            </div>
          </div>

          {gamesResult.games.length ? (
            <>
              <GameGrid games={gamesResult.games} view={view} />
              <Pagination params={params} previousPage={gamesResult.previousPage} nextPage={gamesResult.nextPage} />
            </>
          ) : (
            <EmptyState title="No hay resultados" body="Prueba con otro término de búsqueda, limpia filtros o revisa la configuración de Neon, Meilisearch, IGDB o RAWG." />
          )}
        </div>
      </div>
    </section>
  );
}

function SourceBadge({ source }: { source: string }) {
  const label = source === "meili" ? "Meilisearch" : source === "neon" ? "Neon" : source === "igdb" ? "IGDB" : source === "rawg" ? "RAWG" : "API no disponible";
  return <Badge tone={source === "none" ? "danger" : "lime"}>Datos desde {label}</Badge>;
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline" target="_blank" rel="noreferrer">
      {label}
    </Link>
  );
}

function Pagination({ params, previousPage, nextPage }: { params: Record<string, string | string[] | undefined>; previousPage: number | null; nextPage: number | null }) {
  if (!previousPage && !nextPage) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3">
      <Button asChild href={previousPage ? buildGamesUrl(params, { page: previousPage }) : buildGamesUrl(params, { page: undefined })} variant="secondary" className={!previousPage ? "pointer-events-none opacity-50" : undefined}>
        Anterior
      </Button>
      <Button asChild href={nextPage ? buildGamesUrl(params, { page: nextPage }) : buildGamesUrl(params, { page: undefined })} variant="secondary" className={!nextPage ? "pointer-events-none opacity-50" : undefined}>
        Siguiente
      </Button>
    </nav>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPositivePage(value: string | undefined) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function getOptionalNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function getSort(value: string | undefined): GameSort | undefined {
  return value === "popular" || value === "score" || value === "recent" || value === "upcoming" || value === "reviewed" ? value : undefined;
}

function buildGamesUrl(params: Record<string, string | string[] | undefined>, overrides: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = getSingleParam(value);
    if (single) next.set(key, single);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  if (next.get("page") === "1") next.delete("page");
  const query = next.toString();
  return query ? `/games?${query}` : "/games";
}

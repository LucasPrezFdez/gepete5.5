import type { Metadata } from "next";
import Link from "next/link";
import { GameGrid } from "@/components/games/GameGrid";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { getExploreGames, getPlatformBySlug } from "@/services/games";
import { formatCompactNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MAX_RESULTS = 500;
const MAX_PAGES = MAX_RESULTS / PAGE_SIZE;

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ page?: string }>;

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

async function resolvePlatformName(slug: string) {
  const platform = await getPlatformBySlug(slug);
  return platform?.name ?? humanizeSlug(slug);
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(MAX_PAGES, Math.floor(parsed));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const name = await resolvePlatformName(slug);
  const title = `Juegos para ${name}`;
  const description = `Catálogo completo y los mejores videojuegos para ${name} en GameIndex.`;
  return {
    title,
    description,
    alternates: { canonical: `/platforms/${encodeURIComponent(slug)}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description }
  };
}

export default async function PlatformPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const page = parsePage(search.page);
  const platformName = await resolvePlatformName(slug);
  const gamesResult = await getExploreGames({
    platform: platformName,
    page,
    pageSize: PAGE_SIZE,
    sort: "popular"
  });

  const cappedTotal = Math.min(gamesResult.count, MAX_RESULTS);
  const totalPages = Math.max(1, Math.min(MAX_PAGES, Math.ceil(cappedTotal / PAGE_SIZE)));
  const showingFrom = cappedTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(cappedTotal, page * PAGE_SIZE);

  return (
    <section className="container-page py-10">
      <SectionHeader eyebrow="Plataforma" title={`Populares en ${platformName}`} />
      {cappedTotal > 0 && (
        <p className="mb-5 text-sm text-muted">
          Mostrando {formatCompactNumber(showingFrom)}–{formatCompactNumber(showingTo)} de {formatCompactNumber(cappedTotal)}
          {gamesResult.count > MAX_RESULTS && (
            <> · Total disponible: {formatCompactNumber(gamesResult.count)}</>
          )}
        </p>
      )}
      {gamesResult.error && <p className="mb-5 text-sm text-danger">{gamesResult.error}</p>}
      {cappedTotal === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-muted">
          Aún no hay juegos catalogados para {platformName}. Intenta de nuevo más tarde o explora otras plataformas.
        </p>
      ) : (
        <>
          <GameGrid games={gamesResult.games} highlightPlatform={platformName} />
          <PlatformPagination slug={slug} page={page} totalPages={totalPages} />
        </>
      )}
    </section>
  );
}

function PlatformPagination({ slug, page, totalPages }: { slug: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const prevHref = page > 1 ? buildPageHref(slug, page - 1) : null;
  const nextHref = page < totalPages ? buildPageHref(slug, page + 1) : null;
  const visiblePages = buildPaginationRange(page, totalPages);

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Paginación">
      <PageLink href={prevHref} disabled={!prevHref} ariaLabel="Página anterior">
        ←
      </PageLink>
      {visiblePages.map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`gap-${index}`} className="px-2 text-sm text-muted">
            …
          </span>
        ) : (
          <PageLink key={entry} href={buildPageHref(slug, entry)} active={entry === page}>
            {entry}
          </PageLink>
        )
      )}
      <PageLink href={nextHref} disabled={!nextHref} ariaLabel="Página siguiente">
        →
      </PageLink>
    </nav>
  );
}

function buildPageHref(slug: string, page: number) {
  if (page <= 1) return `/platforms/${slug}`;
  return `/platforms/${slug}?page=${page}`;
}

function buildPaginationRange(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("ellipsis");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("ellipsis");

  items.push(total);
  return items;
}

function PageLink({
  href,
  active,
  disabled,
  ariaLabel,
  children
}: {
  href: string | null;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const baseClass = "grid h-9 min-w-[2.25rem] place-items-center rounded-lg border px-3 text-sm font-bold transition";
  const activeClass = "border-electric bg-electric/10 text-electric";
  const idleClass = "border-white/10 bg-white/[0.03] text-muted hover:border-electric hover:text-fg";
  const disabledClass = "border-white/5 bg-white/[0.02] text-muted/40 cursor-not-allowed";

  if (!href || disabled) {
    return (
      <span aria-disabled className={`${baseClass} ${disabledClass}`} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      className={`${baseClass} ${active ? activeClass : idleClass}`}
    >
      {children}
    </Link>
  );
}

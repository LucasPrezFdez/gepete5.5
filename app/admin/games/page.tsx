import Link from "next/link";
import Image from "next/image";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Table, TableEmptyState, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { createSqlClient } from "@/services/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; filter?: string; staleness?: string; page?: string }>;

const PAGE_SIZE = 25;
const STALE_HOURS = 24;

const FILTERS: Record<string, string> = {
  all: "Todos",
  featured: "Destacados",
  hidden: "Ocultos"
};

const STALENESS: Record<string, string> = {
  any: "Cualquier estado",
  fresh: "Cache fresco (<24h)",
  stale: "Cache antiguo (>24h)",
  never: "Sin sincronizar"
};

export default async function AdminGamesPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, filter, staleness, page } = await searchParams;
  const query = (q ?? "").trim();
  const queryLower = query.toLowerCase();
  const filterValue = filter && FILTERS[filter] ? filter : "all";
  const stalenessValue = staleness && STALENESS[staleness] ? staleness : "any";
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const offset = (pageNumber - 1) * PAGE_SIZE;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (queryLower) {
    conditions.push(`(lower(title) like $${idx} or lower(slug) like $${idx})`);
    params.push(`%${queryLower}%`);
    idx += 1;
  }
  if (filterValue === "featured") conditions.push("is_featured = true");
  if (filterValue === "hidden") conditions.push("is_hidden = true");
  if (stalenessValue === "stale") {
    conditions.push(`(last_synced_at is null or last_synced_at < now() - interval '${STALE_HOURS} hours')`);
  } else if (stalenessValue === "fresh") {
    conditions.push(`last_synced_at >= now() - interval '${STALE_HOURS} hours'`);
  } else if (stalenessValue === "never") {
    conditions.push("last_synced_at is null");
  }
  const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const sql = createSqlClient();
  const totalRows = (await sql.query(
    `select count(*)::int as total from games ${whereClause}`,
    params
  )) as { total: number }[];
  const total = totalRows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const games = (await sql.query(
    `select slug, title, cover_url, status, user_score, last_synced_at,
            is_featured, featured_rank, is_hidden
     from games
     ${whereClause}
     order by popularity_score desc nulls last, title asc
     limit $${idx} offset $${idx + 1}`,
    [...params, PAGE_SIZE, offset]
  )) as Array<{
    slug: string;
    title: string;
    cover_url: string | null;
    status: string | null;
    user_score: number | null;
    last_synced_at: string | null;
    is_featured: boolean;
    featured_rank: number | null;
    is_hidden: boolean;
  }>;

  return (
    <>
      <AdminPageHeader
        title="Catálogo"
        description={`${total.toLocaleString("es-ES")} juegos cacheados. Marca destacados, oculta entradas o fuerza resync.`}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Catálogo" }]}
        actions={
          <Link
            href="/admin/cache"
            className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-muted hover:border-white/[0.18] hover:text-foreground"
          >
            Ver caché global →
          </Link>
        }
      />

      <form method="GET" className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_180px_auto]">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Buscar por título o slug..."
          className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
        />
        <select
          name="filter"
          defaultValue={filterValue}
          className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-foreground focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
        >
          {Object.entries(FILTERS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          name="staleness"
          defaultValue={stalenessValue}
          className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-foreground focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
        >
          {Object.entries(STALENESS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-xl bg-electric px-4 text-[13px] font-semibold text-white hover:bg-electric/90">
          Filtrar
        </button>
      </form>

      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH className="w-20"></TH>
              <TH>Título</TH>
              <TH className="hidden lg:table-cell">Slug</TH>
              <TH className="hidden md:table-cell">Último sync</TH>
              <TH className="hidden sm:table-cell">Score</TH>
              <TH>Flags</TH>
              <TH className="text-right">Acción</TH>
            </tr>
          </THead>
          <TBody>
            {games.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <TableEmptyState title="Sin resultados" description="Cambia los filtros o sincroniza más juegos." />
                </td>
              </tr>
            ) : (
              games.map((game) => (
                <TR key={game.slug}>
                  <TD>
                    {game.cover_url ? (
                      <Image
                        src={game.cover_url}
                        alt=""
                        width={120}
                        height={160}
                        quality={90}
                        sizes="64px"
                        className="h-20 w-16 rounded-md object-cover shadow-md ring-1 ring-white/[0.08]"
                      />
                    ) : (
                      <div className="h-20 w-16 rounded-md bg-white/[0.05]" aria-hidden />
                    )}
                  </TD>
                  <TD>
                    <Link
                      href={`/admin/games/${encodeURIComponent(game.slug)}`}
                      className="font-semibold hover:text-electric"
                    >
                      {game.title}
                    </Link>
                  </TD>
                  <TD className="hidden lg:table-cell font-mono text-[11.5px] text-muted">
                    {game.slug}
                  </TD>
                  <TD className="hidden md:table-cell font-mono text-[11.5px] text-muted">
                    {formatLastSynced(game.last_synced_at)}
                  </TD>
                  <TD className="hidden sm:table-cell tabular-nums">
                    {game.user_score ? Number(game.user_score).toFixed(1) : <span className="text-muted">—</span>}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {game.is_featured && (
                        <span className="rounded bg-[#A3E635]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A3E635]">
                          Destacado{game.featured_rank ? ` #${game.featured_rank}` : ""}
                        </span>
                      )}
                      {game.is_hidden && (
                        <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
                          Oculto
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/admin/games/${encodeURIComponent(game.slug)}`}
                      className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-muted hover:border-white/[0.18] hover:text-foreground"
                    >
                      Gestionar →
                    </Link>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>

      <Pagination page={pageNumber} pages={pages} query={query} filter={filterValue} staleness={stalenessValue} />
    </>
  );
}

function Pagination(props: { page: number; pages: number; query: string; filter: string; staleness: string }) {
  if (props.pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-[12.5px] text-muted" aria-label="Paginación">
      <span className="font-mono">Página {props.page} de {props.pages}</span>
      <div className="flex gap-2">
        <PageLink {...props} target={Math.max(1, props.page - 1)} label="← Anterior" disabled={props.page <= 1} />
        <PageLink {...props} target={Math.min(props.pages, props.page + 1)} label="Siguiente →" disabled={props.page >= props.pages} />
      </div>
    </nav>
  );
}

function PageLink({
  target,
  label,
  query,
  filter,
  staleness,
  disabled
}: {
  target: number;
  label: string;
  query: string;
  filter: string;
  staleness: string;
  disabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("filter", filter);
  if (staleness !== "any") params.set("staleness", staleness);
  params.set("page", String(target));
  const href = `/admin/games?${params.toString()}`;
  if (disabled) {
    return <span className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-1.5 opacity-40">{label}</span>;
  }
  return (
    <Link
      href={href}
      className={cn("rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 hover:border-white/[0.18] hover:text-foreground")}
    >
      {label}
    </Link>
  );
}

function formatLastSynced(iso: string | null) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return iso;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

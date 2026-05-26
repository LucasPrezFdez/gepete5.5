import Link from "next/link";
import Image from "next/image";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { CacheActions } from "@/components/admin/cache/CacheActions";
import { Table, TableEmptyState, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { createSqlClient } from "@/services/database";

export const dynamic = "force-dynamic";

const STALE_HOURS = 24;

export default async function AdminCachePage() {
  const sql = createSqlClient();
  const [totalRows, neverRows, staleRows, freshRows, noCoverRows, staleListRows, recentJobs] = await Promise.all([
    sql.query("select count(*)::int as n from games"),
    sql.query("select count(*)::int as n from games where last_synced_at is null"),
    sql.query(`select count(*)::int as n from games where last_synced_at is not null and last_synced_at < now() - interval '${STALE_HOURS} hours'`),
    sql.query(`select count(*)::int as n from games where last_synced_at >= now() - interval '${STALE_HOURS} hours'`),
    sql.query("select count(*)::int as n from games where cover_url is null or cover_url = ''"),
    sql.query(
      `select slug, title, cover_url, last_synced_at
       from games
       where last_synced_at is null or last_synced_at < now() - interval '${STALE_HOURS} hours'
       order by last_synced_at asc nulls first, popularity_score desc nulls last
       limit 50`
    ),
    sql.query(
      `select id, type, status, progress, total, error_message, created_at, finished_at
       from admin_jobs
       order by created_at desc limit 8`
    )
  ]);

  const total = pick(totalRows);
  const never = pick(neverRows);
  const stale = pick(staleRows);
  const fresh = pick(freshRows);
  const noCover = pick(noCoverRows);

  return (
    <>
      <AdminPageHeader
        title="Caché"
        description={`Estado de las ${total.toLocaleString("es-ES")} entradas cacheadas. Resincroniza por lotes y rellena portadas faltantes.`}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Caché" }]}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total cacheados" value={total} />
        <StatCard label="Sin sync" value={never} tone={never > 0 ? "warn" : "default"} hint="Nunca refrescados desde IGDB/RAWG" />
        <StatCard label={`Cache >${STALE_HOURS}h`} value={stale} tone={stale > 0 ? "warn" : "default"} />
        <StatCard label="Cache fresco" value={fresh} tone="accent" hint={`Refrescados en las últimas ${STALE_HOURS}h`} />
      </section>

      <section className="mb-6">
        <StatCard label="Sin portada" value={noCover} tone={noCover > 0 ? "warn" : "default"} hint="Entradas sin cover_url" className="max-w-md" />
      </section>

      <CacheActions />

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Top juegos con caché antiguo</h2>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH className="w-20"></TH>
                <TH>Título</TH>
                <TH className="hidden md:table-cell">Slug</TH>
                <TH>Último sync</TH>
                <TH className="text-right">Acción</TH>
              </tr>
            </THead>
            <TBody>
              {(staleListRows as any[]).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <TableEmptyState title="¡Todo fresco!" description="Ningún juego con caché antiguo." />
                  </td>
                </tr>
              ) : (
                (staleListRows as any[]).map((row) => (
                  <TR key={row.slug}>
                    <TD>
                      {row.cover_url ? (
                        <Image
                          src={row.cover_url}
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
                    <TD className="font-semibold">{row.title}</TD>
                    <TD className="hidden md:table-cell font-mono text-[11.5px] text-muted">{row.slug}</TD>
                    <TD className="font-mono text-[11.5px] text-muted">
                      {row.last_synced_at ? new Date(row.last_synced_at).toLocaleString("es-ES") : <span className="text-danger">nunca</span>}
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/admin/games/${encodeURIComponent(row.slug)}`}
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
      </section>

      {(recentJobs as any[]).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Jobs recientes</h2>
          <ul className="space-y-1.5">
            {(recentJobs as any[]).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[13px]"
              >
                <div>
                  <p className="font-semibold">{row.type}</p>
                  <p className="font-mono text-[11.5px] text-muted">{row.id}</p>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-muted">
                  <span
                    className={
                      row.status === "done"
                        ? "text-[#A3E635]"
                        : row.status === "error"
                        ? "text-danger"
                        : "text-electric"
                    }
                  >
                    {row.status}
                  </span>
                  {row.total !== null && (
                    <span className="font-mono">
                      {row.progress.toLocaleString("es-ES")} / {row.total.toLocaleString("es-ES")}
                    </span>
                  )}
                  <time dateTime={row.created_at} className="font-mono text-[11px]">
                    {new Date(row.created_at).toLocaleString("es-ES")}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function pick(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  const value = (rows[0] as any)?.n;
  return typeof value === "number" ? value : Number(value ?? 0);
}

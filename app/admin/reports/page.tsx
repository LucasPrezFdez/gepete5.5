import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Table, TableEmptyState, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { createSqlClient } from "@/services/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; page?: string }>;

const STATUSES = ["pending", "resolved", "dismissed"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendientes",
  resolved: "Resueltos",
  dismissed: "Descartados"
};

const PAGE_SIZE = 25;
const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  harassment: "Acoso",
  spoiler: "Spoilers",
  offensive: "Ofensivo",
  inaccurate: "Inexacto",
  other: "Otro"
};
const TARGET_LABEL: Record<string, string> = {
  review: "Reseña",
  list: "Lista",
  profile: "Perfil",
  comment: "Comentario",
  game: "Juego"
};

export default async function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { status, page } = await searchParams;
  const currentStatus: Status = STATUSES.includes(status as Status) ? (status as Status) : "pending";
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const offset = (pageNumber - 1) * PAGE_SIZE;

  const sql = createSqlClient();
  const counts = (await sql.query(
    "select status, count(*)::int as n from content_reports group by status"
  )) as Array<{ status: string; n: number }>;
  const countsByStatus = new Map(counts.map((row) => [row.status, row.n] as const));

  const totalRows = (await sql.query(
    "select count(*)::int as total from content_reports where status = $1",
    [currentStatus]
  )) as { total: number }[];
  const total = totalRows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = (await sql.query(
    `select id, reporter_user_id, target_type, target_id, reason, details, created_at, resolved_at
     from content_reports
     where status = $1
     order by created_at desc
     limit $2 offset $3`,
    [currentStatus, PAGE_SIZE, offset]
  )) as Array<{
    id: string;
    reporter_user_id: string | null;
    target_type: string;
    target_id: string;
    reason: string;
    details: string | null;
    created_at: string;
    resolved_at: string | null;
  }>;

  const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_user_id).filter(Boolean) as string[]));
  let reporters = new Map<string, { username: string }>();
  if (reporterIds.length) {
    const reporterRows = (await sql.query(
      "select id, username from app_users where id = any($1::uuid[])",
      [reporterIds]
    )) as Array<{ id: string; username: string }>;
    reporters = new Map(reporterRows.map((row) => [row.id, { username: row.username }]));
  }

  return (
    <>
      <AdminPageHeader
        title="Moderación"
        description="Cola de reportes de la comunidad. Resuelve, descarta y oculta contenido cuando proceda."
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Moderación" }]}
      />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filtrar reportes por estado">
        {STATUSES.map((value) => {
          const active = value === currentStatus;
          const count = countsByStatus.get(value) ?? 0;
          return (
            <Link
              key={value}
              href={value === "pending" ? "/admin/reports" : `/admin/reports?status=${value}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold motion-safe:transition-colors",
                active
                  ? "border-[#A3E635]/40 bg-[#A3E635]/10 text-[#A3E635]"
                  : "border-white/[0.08] bg-white/[0.02] text-muted hover:text-foreground"
              )}
            >
              {STATUS_LABEL[value]}
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                  active ? "bg-[#A3E635]/20" : "bg-white/[0.06]"
                )}
              >
                {count.toLocaleString("es-ES")}
              </span>
            </Link>
          );
        })}
      </nav>

      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>Tipo</TH>
              <TH>Motivo</TH>
              <TH className="hidden md:table-cell">Detalles</TH>
              <TH className="hidden sm:table-cell">Reporter</TH>
              <TH>Fecha</TH>
              <TH className="text-right">Acción</TH>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <TableEmptyState
                    title={currentStatus === "pending" ? "Sin reportes pendientes" : `Sin reportes ${STATUS_LABEL[currentStatus].toLowerCase()}`}
                    description={currentStatus === "pending" ? "¡Todo limpio por ahora!" : "Cambia el filtro para ver otros estados."}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const reporter = row.reporter_user_id ? reporters.get(row.reporter_user_id) : null;
                return (
                  <TR key={row.id}>
                    <TD>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {TARGET_LABEL[row.target_type] ?? row.target_type}
                      </span>
                    </TD>
                    <TD>
                      <Link href={`/admin/reports/${row.id}`} className="font-semibold hover:text-electric">
                        {REASON_LABEL[row.reason] ?? row.reason}
                      </Link>
                    </TD>
                    <TD className="hidden md:table-cell max-w-md truncate text-[12.5px] text-muted">
                      {row.details ?? "—"}
                    </TD>
                    <TD className="hidden sm:table-cell text-[12px] text-muted">
                      {reporter ? `@${reporter.username}` : <span className="italic text-muted/60">anónimo</span>}
                    </TD>
                    <TD className="font-mono text-[11.5px] text-muted">{formatRelative(row.created_at)}</TD>
                    <TD className="text-right">
                      <Link
                        href={`/admin/reports/${row.id}`}
                        className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-muted hover:border-white/[0.18] hover:text-foreground"
                      >
                        Revisar →
                      </Link>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>

      <Pagination page={pageNumber} pages={pages} status={currentStatus} />
    </>
  );
}

function Pagination({ page, pages, status }: { page: number; pages: number; status: Status }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-[12.5px] text-muted" aria-label="Paginación">
      <span className="font-mono">
        Página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <PageLink page={Math.max(1, page - 1)} label="← Anterior" status={status} disabled={page <= 1} />
        <PageLink page={Math.min(pages, page + 1)} label="Siguiente →" status={status} disabled={page >= pages} />
      </div>
    </nav>
  );
}

function PageLink({
  page,
  label,
  status,
  disabled
}: {
  page: number;
  label: string;
  status: Status;
  disabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (status !== "pending") params.set("status", status);
  params.set("page", String(page));
  const href = `/admin/reports?${params.toString()}`;
  if (disabled) {
    return <span className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-1.5 opacity-40">{label}</span>;
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 hover:border-white/[0.18] hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function formatRelative(iso: string) {
  if (!iso) return "";
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

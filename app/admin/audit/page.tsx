import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Table, TableEmptyState, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { listAuditLog, type AdminAuditAction, type AdminAuditTargetType } from "@/services/admin-audit";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ action?: string; targetType?: string; page?: string }>;

const PAGE_SIZE = 50;

const ACTION_LABEL: Record<AdminAuditAction, string> = {
  "user.ban": "Baneo de usuario",
  "user.unban": "Levantamiento de baneo",
  "user.promote": "Promoción a admin",
  "user.demote": "Retirada de admin",
  "content.hide": "Ocultar contenido",
  "content.unhide": "Restaurar contenido",
  "report.resolve": "Reporte resuelto",
  "report.dismiss": "Reporte descartado",
  "game.resync": "Resync de juego",
  "game.update": "Edición de juego",
  "game.feature": "Destacar juego",
  "cache.backfill": "Backfill de caché",
  "cache.bulk_resync": "Resync masivo",
  "seed.fallback_users": "Seed de usuarios"
};

const TARGET_LABEL: Record<AdminAuditTargetType, string> = {
  user: "Usuario",
  review: "Reseña",
  list: "Lista",
  rating: "Valoración",
  comment: "Comentario",
  profile: "Perfil",
  report: "Reporte",
  game: "Juego",
  cache: "Caché",
  job: "Trabajo"
};

const ACTION_TONE: Record<AdminAuditAction, "danger" | "warn" | "info" | "neutral"> = {
  "user.ban": "danger",
  "user.unban": "info",
  "user.promote": "warn",
  "user.demote": "warn",
  "content.hide": "danger",
  "content.unhide": "info",
  "report.resolve": "info",
  "report.dismiss": "neutral",
  "game.resync": "neutral",
  "game.update": "neutral",
  "game.feature": "warn",
  "cache.backfill": "neutral",
  "cache.bulk_resync": "warn",
  "seed.fallback_users": "neutral"
};

const TONE_CLASS: Record<"danger" | "warn" | "info" | "neutral", string> = {
  danger: "bg-danger/15 text-danger",
  warn: "bg-amber-500/15 text-amber-300",
  info: "bg-electric/15 text-electric",
  neutral: "bg-white/[0.06] text-muted"
};

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { action, targetType, page } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const offset = (pageNumber - 1) * PAGE_SIZE;

  const filter = {
    action: isAction(action) ? action : undefined,
    targetType: isTarget(targetType) ? targetType : undefined
  };

  const { entries, total } = await listAuditLog({
    limit: PAGE_SIZE,
    offset,
    action: filter.action,
    targetType: filter.targetType
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHeader
        title="Registro de auditoría"
        description="Trazabilidad de todas las acciones administrativas realizadas en la plataforma."
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Auditoría" }]}
      />

      <div className="mb-4 flex flex-wrap gap-3 text-[12.5px]">
        <FilterGroup
          label="Acción"
          options={Object.keys(ACTION_LABEL) as AdminAuditAction[]}
          renderLabel={(value) => ACTION_LABEL[value as AdminAuditAction]}
          activeValue={filter.action}
          paramName="action"
          targetType={filter.targetType}
        />
        <FilterGroup
          label="Tipo"
          options={Object.keys(TARGET_LABEL) as AdminAuditTargetType[]}
          renderLabel={(value) => TARGET_LABEL[value as AdminAuditTargetType]}
          activeValue={filter.targetType}
          paramName="targetType"
          action={filter.action}
        />
      </div>

      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>Acción</TH>
              <TH>Objetivo</TH>
              <TH className="hidden md:table-cell">Detalle</TH>
              <TH>Admin</TH>
              <TH className="hidden sm:table-cell">IP</TH>
              <TH className="text-right">Cuándo</TH>
            </tr>
          </THead>
          <TBody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <TableEmptyState
                    title="Sin registros"
                    description="No hay acciones registradas con los filtros aplicados."
                  />
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <TR key={entry.id}>
                  <TD>
                    <span
                      className={cn(
                        "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        TONE_CLASS[ACTION_TONE[entry.action] ?? "neutral"]
                      )}
                    >
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </span>
                  </TD>
                  <TD className="text-[12.5px]">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        {TARGET_LABEL[entry.targetType] ?? entry.targetType}
                      </span>
                      {entry.targetLabel ? (
                        <span className="text-[11px] text-muted">{entry.targetLabel}</span>
                      ) : entry.targetId ? (
                        <span className="font-mono text-[10.5px] text-muted/70">
                          {entry.targetId.slice(0, 12)}…
                        </span>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell max-w-md text-[11.5px] text-muted">
                    <MetadataSummary metadata={entry.metadata} />
                  </TD>
                  <TD className="text-[12px]">
                    {entry.adminUsername ? (
                      <span className="font-semibold">@{entry.adminUsername}</span>
                    ) : (
                      <span className="italic text-muted">desconocido</span>
                    )}
                  </TD>
                  <TD className="hidden sm:table-cell font-mono text-[11px] text-muted/80">
                    {entry.ipAddress ?? "—"}
                  </TD>
                  <TD className="text-right font-mono text-[11px] text-muted" title={entry.createdAt}>
                    {formatRelative(entry.createdAt)}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>

      <Pagination page={pageNumber} pages={pages} filter={filter} />
    </>
  );
}

function FilterGroup({
  label,
  options,
  renderLabel,
  activeValue,
  paramName,
  action,
  targetType
}: {
  label: string;
  options: string[];
  renderLabel: (value: string) => string;
  activeValue?: string;
  paramName: "action" | "targetType";
  action?: AdminAuditAction;
  targetType?: AdminAuditTargetType;
}) {
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 font-semibold text-muted hover:text-foreground">
        {label}
        {activeValue ? (
          <span className="rounded bg-[#A3E635]/15 px-1.5 py-0.5 text-[10px] text-[#A3E635]">
            {renderLabel(activeValue)}
          </span>
        ) : (
          <span className="text-[10px] text-muted/60">todos</span>
        )}
        <span className="text-[10px] transition group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-white/[0.08] bg-background/95 p-1 shadow-xl backdrop-blur">
        <FilterLink
          href={buildFilterHref({ action, targetType, [paramName]: undefined })}
          active={!activeValue}
          label="Todos"
        />
        {options.map((value) => (
          <FilterLink
            key={value}
            href={buildFilterHref({
              action: paramName === "action" ? (value as AdminAuditAction) : action,
              targetType: paramName === "targetType" ? (value as AdminAuditTargetType) : targetType
            })}
            active={activeValue === value}
            label={renderLabel(value)}
          />
        ))}
      </div>
    </details>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-3 py-1.5 text-[12.5px]",
        active ? "bg-white/[0.07] text-foreground" : "text-muted hover:bg-white/[0.04] hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

function buildFilterHref(filter: { action?: AdminAuditAction; targetType?: AdminAuditTargetType }) {
  const params = new URLSearchParams();
  if (filter.action) params.set("action", filter.action);
  if (filter.targetType) params.set("targetType", filter.targetType);
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

function MetadataSummary({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (entries.length === 0) return <span className="italic text-muted/50">—</span>;
  return (
    <ul className="space-y-0.5">
      {entries.slice(0, 4).map(([key, value]) => (
        <li key={key} className="truncate">
          <span className="text-muted/60">{key}:</span>{" "}
          <span className="text-muted">{formatValue(value)}</span>
        </li>
      ))}
    </ul>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (typeof value === "string" && value.length > 60) return value.slice(0, 57) + "…";
  if (value === null || value === undefined) return "—";
  return String(value);
}

function Pagination({
  page,
  pages,
  filter
}: {
  page: number;
  pages: number;
  filter: { action?: AdminAuditAction; targetType?: AdminAuditTargetType };
}) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-[12.5px] text-muted">
      <span className="font-mono">
        Página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <PageLink page={Math.max(1, page - 1)} label="← Anterior" filter={filter} disabled={page <= 1} />
        <PageLink page={Math.min(pages, page + 1)} label="Siguiente →" filter={filter} disabled={page >= pages} />
      </div>
    </nav>
  );
}

function PageLink({
  page,
  label,
  filter,
  disabled
}: {
  page: number;
  label: string;
  filter: { action?: AdminAuditAction; targetType?: AdminAuditTargetType };
  disabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (filter.action) params.set("action", filter.action);
  if (filter.targetType) params.set("targetType", filter.targetType);
  params.set("page", String(page));
  const href = `/admin/audit?${params.toString()}`;
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

function isAction(value: unknown): value is AdminAuditAction {
  return typeof value === "string" && value in ACTION_LABEL;
}

function isTarget(value: unknown): value is AdminAuditTargetType {
  return typeof value === "string" && value in TARGET_LABEL;
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

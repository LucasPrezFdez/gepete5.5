import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { HealthBadge } from "@/components/admin/HealthBadge";
import { loadAdminStats } from "@/services/admin-stats";

export const dynamic = "force-dynamic";

const REPORT_REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  harassment: "Acoso",
  spoiler: "Spoilers",
  offensive: "Ofensivo",
  inaccurate: "Inexacto",
  other: "Otro"
};

const REPORT_TARGET_LABEL: Record<string, string> = {
  review: "Reseña",
  list: "Lista",
  profile: "Perfil",
  comment: "Comentario",
  game: "Juego"
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  resolved: "Resuelto",
  dismissed: "Descartado"
};

export default async function AdminDashboardPage() {
  const data = await loadAdminStats();
  const { stats, health, recent } = data;

  return (
    <>
      <AdminPageHeader
        title="Panel de control"
        description="Visión rápida de la comunidad, la moderación y el catálogo."
        crumbs={[{ label: "Admin" }]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuarios"
          value={stats.users.total}
          hint={`${stats.users.banned.toLocaleString("es-ES")} con cuenta suspendida`}
          href="/admin/users"
        />
        <StatCard
          label="Nuevos 7d"
          value={stats.users.newLast7d}
          hint="Altas en los últimos 7 días"
        />
        <StatCard
          label="Reseñas 7d"
          value={stats.reviews.last7d}
          hint="Reseñas publicadas esta semana"
        />
        <StatCard
          label="Reportes pendientes"
          value={stats.reports.pending}
          hint="Cola de moderación"
          href="/admin/reports"
          tone={stats.reports.pending > 0 ? "accent" : "default"}
        />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Catálogo"
          value={stats.catalog.total}
          hint={`${stats.catalog.stale.toLocaleString("es-ES")} con caché > ${stats.catalog.staleHours}h`}
          href="/admin/cache"
          tone={stats.catalog.stale > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Contenido oculto"
          value={stats.moderation.hiddenContent}
          hint="Reseñas, listas y comentarios"
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Últimos reportes</h2>
            <Link href="/admin/reports" className="text-[12px] font-semibold text-[#A3E635] hover:underline">
              Ver todos →
            </Link>
          </header>
          {recent.reports.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center text-[13px] text-muted">
              Sin reportes recientes.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recent.reports.map((report) => (
                <li
                  key={report.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[13px]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {REPORT_TARGET_LABEL[report.targetType] ?? report.targetType}
                    </span>
                    <span className="truncate font-medium">
                      {REPORT_REASON_LABEL[report.reason] ?? report.reason}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted">
                    <span
                      className={
                        report.status === "pending"
                          ? "text-[#A3E635]"
                          : report.status === "resolved"
                          ? "text-electric"
                          : "text-muted"
                      }
                    >
                      {REPORT_STATUS_LABEL[report.status] ?? report.status}
                    </span>
                    <RelativeTime iso={report.createdAt} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Últimos usuarios</h2>
            <Link href="/admin/users" className="text-[12px] font-semibold text-[#A3E635] hover:underline">
              Ver todos →
            </Link>
          </header>
          {recent.users.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center text-[13px] text-muted">
              Sin usuarios recientes.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recent.users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[13px]"
                >
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 hover:text-foreground"
                  >
                    <span className="truncate font-medium">{user.displayName}</span>
                    <span className="truncate text-[11px] text-muted">@{user.username}</span>
                    {user.isAdmin && (
                      <span className="rounded bg-[#A3E635]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#A3E635]">
                        Admin
                      </span>
                    )}
                    {user.isBanned && (
                      <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">
                        Baneado
                      </span>
                    )}
                  </Link>
                  <RelativeTime iso={user.createdAt} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Estado del sistema</h2>
        <div className="flex flex-wrap gap-2">
          <HealthBadge label="Base de datos" status={health.database} detail="Neon" />
          <HealthBadge
            label="IGDB"
            status={health.igdb}
            detail={health.igdb === "ok" ? "configurado" : "sin credenciales"}
          />
          <HealthBadge
            label="RAWG"
            status={health.rawg}
            detail={health.rawg === "ok" ? "configurado" : "sin API key"}
          />
          <HealthBadge
            label="Meilisearch"
            status={health.meilisearch}
            detail={health.meilisearch === "ok" ? "configurado" : "no activo"}
          />
          <HealthBadge
            label="Groq (chat)"
            status={health.groq}
            detail={health.groq === "ok" ? "configurado" : "no activo"}
          />
        </div>
      </section>
    </>
  );
}

function RelativeTime({ iso }: { iso: string | null }) {
  if (!iso) return null;
  return (
    <time dateTime={iso} className="font-mono text-[10.5px] text-muted/80" title={iso}>
      {formatRelative(iso)}
    </time>
  );
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return iso;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

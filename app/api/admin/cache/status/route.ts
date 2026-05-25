import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/cache/status");
const STALE_HOURS = 24;

export async function GET(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  try {
    const sql = createSqlClient();
    const [totalRows, neverRows, staleRows, freshRows, withoutCoverRows, staleListRows, latestJobRows] = await Promise.all([
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
        `select id, type, status, progress, total, error_message, created_at, started_at, finished_at
         from admin_jobs
         order by created_at desc limit 10`
      )
    ]);

    return jsonOk({
      stats: {
        total: pick(totalRows),
        never: pick(neverRows),
        stale: pick(staleRows),
        fresh: pick(freshRows),
        withoutCover: pick(withoutCoverRows),
        staleHours: STALE_HOURS
      },
      stale: (staleListRows as any[]).map((row) => ({
        slug: row.slug,
        title: row.title,
        coverUrl: row.cover_url,
        lastSyncedAt: row.last_synced_at
      })),
      jobs: (latestJobRows as any[]).map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        progress: row.progress,
        total: row.total,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at
      }))
    });
  } catch (error) {
    log.error("cache status failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudo cargar el estado de la caché.", 500);
  }
}

function pick(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  const value = (rows[0] as any)?.n;
  return typeof value === "number" ? value : Number(value ?? 0);
}

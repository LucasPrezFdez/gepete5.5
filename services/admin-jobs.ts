import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";
import { forceResyncGameBySlug } from "@/services/games";

const log = createLogger("admin-jobs");

export type AdminJobType = "backfill_covers" | "bulk_resync";
export type AdminJobStatus = "pending" | "running" | "done" | "error";

export type AdminJob = {
  id: string;
  type: AdminJobType;
  status: AdminJobStatus;
  progress: number;
  total: number | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export async function createJob(type: AdminJobType, startedBy: string): Promise<string> {
  const sql = createSqlClient();
  const rows = (await sql.query(
    "insert into admin_jobs (type, status, started_by) values ($1, 'pending', $2) returning id",
    [type, startedBy]
  )) as Array<{ id: string }>;
  return rows[0].id;
}

export async function getJob(id: string): Promise<AdminJob | null> {
  const sql = createSqlClient();
  const rows = (await sql.query(
    `select id, type, status, progress, total, error_message, created_at, started_at, finished_at
     from admin_jobs where id = $1 limit 1`,
    [id]
  )) as Array<any>;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    progress: row.progress ?? 0,
    total: row.total,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

async function markRunning(jobId: string, total: number) {
  const sql = createSqlClient();
  await sql.query(
    "update admin_jobs set status = 'running', total = $2, started_at = now() where id = $1",
    [jobId, total]
  );
}

async function updateProgress(jobId: string, progress: number) {
  const sql = createSqlClient();
  await sql.query("update admin_jobs set progress = $2 where id = $1", [jobId, progress]);
}

async function markDone(jobId: string) {
  const sql = createSqlClient();
  await sql.query(
    "update admin_jobs set status = 'done', finished_at = now() where id = $1",
    [jobId]
  );
}

async function markError(jobId: string, message: string) {
  const sql = createSqlClient();
  await sql.query(
    "update admin_jobs set status = 'error', error_message = $2, finished_at = now() where id = $1",
    [jobId, message]
  );
}

export async function runBulkResyncJob(jobId: string, limit: number) {
  try {
    const sql = createSqlClient();
    const rows = (await sql.query(
      `select slug from games
       where last_synced_at is null or last_synced_at < now() - interval '24 hours'
       order by last_synced_at asc nulls first, popularity_score desc nulls last
       limit $1`,
      [limit]
    )) as Array<{ slug: string }>;
    await markRunning(jobId, rows.length);

    let done = 0;
    for (const row of rows) {
      try {
        await forceResyncGameBySlug(row.slug);
      } catch (error) {
        log.warn("resync item failed", { slug: row.slug, error: error instanceof Error ? error.message : String(error) });
      }
      done += 1;
      if (done % 5 === 0 || done === rows.length) {
        await updateProgress(jobId, done);
      }
    }
    await markDone(jobId);
  } catch (error) {
    log.error("bulk_resync job error", { jobId, error: error instanceof Error ? error.message : String(error) });
    await markError(jobId, error instanceof Error ? error.message : String(error));
  }
}

export async function runBackfillCoversJob(jobId: string, limit: number) {
  try {
    const sql = createSqlClient();
    const rows = (await sql.query(
      `select slug from games
       where cover_url is null or cover_url = ''
       order by popularity_score desc nulls last, title asc
       limit $1`,
      [limit]
    )) as Array<{ slug: string }>;
    await markRunning(jobId, rows.length);

    let done = 0;
    for (const row of rows) {
      try {
        await forceResyncGameBySlug(row.slug);
      } catch (error) {
        log.warn("backfill cover item failed", { slug: row.slug, error: error instanceof Error ? error.message : String(error) });
      }
      done += 1;
      if (done % 5 === 0 || done === rows.length) {
        await updateProgress(jobId, done);
      }
    }
    await markDone(jobId);
  } catch (error) {
    log.error("backfill_covers job error", { jobId, error: error instanceof Error ? error.message : String(error) });
    await markError(jobId, error instanceof Error ? error.message : String(error));
  }
}

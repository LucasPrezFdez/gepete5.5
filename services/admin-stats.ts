import { createSqlClient } from "@/services/database";

export const STALE_CACHE_HOURS = 24;
const TIMESERIES_DAYS = 30;

export type IntegrationStatus = "ok" | "warn" | "down" | "unknown";

export type TimeSeriesPoint = { date: string; value: number };
export type CategoryDatum = { label: string; value: number };

export type AdminStats = {
  stats: {
    users: { total: number; newLast7d: number; banned: number };
    reviews: { last7d: number };
    reports: { pending: number };
    catalog: { total: number; stale: number; staleHours: number };
    moderation: { hiddenContent: number };
  };
  health: {
    database: IntegrationStatus;
    igdb: IntegrationStatus;
    rawg: IntegrationStatus;
    groq: IntegrationStatus;
    meilisearch: IntegrationStatus;
  };
  charts: {
    userSignups: TimeSeriesPoint[];
    reviewsPerDay: TimeSeriesPoint[];
    reportsByReason: CategoryDatum[];
    catalogBySource: CategoryDatum[];
  };
  recent: {
    reports: Array<{
      id: string;
      targetType: string;
      reason: string;
      status: string;
      createdAt: string;
    }>;
    users: Array<{
      id: string;
      username: string;
      displayName: string;
      createdAt: string;
      isAdmin: boolean;
      isBanned: boolean;
    }>;
  };
};

export async function loadAdminStats(): Promise<AdminStats> {
  const sql = createSqlClient();
  const [
    totalUsersRows,
    newUsersRows,
    bannedUsersRows,
    reviewsRecentRows,
    reportsPendingRows,
    gamesRows,
    staleGamesRows,
    hiddenContentRows,
    recentReportsRows,
    recentUsersRows,
    userSignupsRows,
    reviewsPerDayRows,
    reportsByReasonRows,
    catalogBySourceRows
  ] = await Promise.all([
    sql.query("select count(*)::int as count from app_users"),
    sql.query("select count(*)::int as count from app_users where created_at >= now() - interval '7 days'"),
    sql.query("select count(*)::int as count from app_users where banned_at is not null and (banned_until is null or banned_until > now())"),
    sql.query("select count(*)::int as count from reviews where created_at >= now() - interval '7 days'"),
    sql.query("select count(*)::int as count from content_reports where status = 'pending'"),
    sql.query("select count(*)::int as count from games"),
    sql.query(`select count(*)::int as count from games where last_synced_at is null or last_synced_at < now() - interval '${STALE_CACHE_HOURS} hours'`),
    sql.query("select (select count(*) from reviews where hidden_at is not null)::int + (select count(*) from lists where hidden_at is not null)::int + (select count(*) from ratings where hidden_at is not null)::int as count"),
    sql.query("select id, target_type, reason, status, created_at from content_reports order by created_at desc limit 8"),
    sql.query("select id, username, display_name, created_at, is_admin, banned_at from app_users order by created_at desc limit 8"),
    sql.query(
      `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, count(*)::int as count
       from app_users
       where created_at >= now() - interval '${TIMESERIES_DAYS} days'
       group by 1
       order by 1 asc`
    ),
    sql.query(
      `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, count(*)::int as count
       from reviews
       where created_at >= now() - interval '${TIMESERIES_DAYS} days'
       group by 1
       order by 1 asc`
    ),
    sql.query(
      `select reason as label, count(*)::int as count
       from content_reports
       group by reason
       order by count desc`
    ),
    sql.query(
      `select coalesce(provider, 'none') as label, count(*)::int as count
       from external_sources
       group by provider
       order by count desc`
    )
  ]);

  return {
    stats: {
      users: {
        total: pickCount(totalUsersRows),
        newLast7d: pickCount(newUsersRows),
        banned: pickCount(bannedUsersRows)
      },
      reviews: { last7d: pickCount(reviewsRecentRows) },
      reports: { pending: pickCount(reportsPendingRows) },
      catalog: {
        total: pickCount(gamesRows),
        stale: pickCount(staleGamesRows),
        staleHours: STALE_CACHE_HOURS
      },
      moderation: { hiddenContent: pickCount(hiddenContentRows) }
    },
    health: {
      database: "ok",
      igdb: integrationStatus(Boolean(process.env.IGDB_CLIENT_ID?.trim() && process.env.IGDB_CLIENT_SECRET?.trim())),
      rawg: integrationStatus(Boolean(process.env.RAWG_API_KEY?.trim())),
      groq: integrationStatus(Boolean(process.env.GROQ_API_KEY?.trim())),
      meilisearch: integrationStatus(Boolean(process.env.MEILISEARCH_HOST?.trim()))
    },
    charts: {
      userSignups: fillTimeSeries(userSignupsRows, TIMESERIES_DAYS),
      reviewsPerDay: fillTimeSeries(reviewsPerDayRows, TIMESERIES_DAYS),
      reportsByReason: toCategoryData(reportsByReasonRows),
      catalogBySource: toCategoryData(catalogBySourceRows)
    },
    recent: {
      reports: (recentReportsRows as any[]).map((row) => ({
        id: row.id,
        targetType: row.target_type,
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at
      })),
      users: (recentUsersRows as any[]).map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name ?? row.username,
        createdAt: row.created_at,
        isAdmin: Boolean(row.is_admin),
        isBanned: Boolean(row.banned_at)
      }))
    }
  };
}

function pickCount(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  const value = (rows[0] as any)?.count;
  return typeof value === "number" ? value : Number(value ?? 0);
}

function integrationStatus(configured: boolean): IntegrationStatus {
  return configured ? "ok" : "unknown";
}

function fillTimeSeries(rows: unknown, days: number): TimeSeriesPoint[] {
  const byDate = new Map<string, number>();
  if (Array.isArray(rows)) {
    for (const row of rows as Array<{ date: string; count: number | string }>) {
      if (!row?.date) continue;
      byDate.set(row.date, Number(row.count ?? 0));
    }
  }

  const points: TimeSeriesPoint[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    points.push({ date: key, value: byDate.get(key) ?? 0 });
  }
  return points;
}

function toCategoryData(rows: unknown): CategoryDatum[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Array<{ label: string; count: number | string }>)
    .filter((row) => row?.label)
    .map((row) => ({ label: row.label, value: Number(row.count ?? 0) }));
}

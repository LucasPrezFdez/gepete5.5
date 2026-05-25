import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/games");
const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const STALE_HOURS = 24;

export async function GET(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const filter = url.searchParams.get("filter") ?? "all";
    const staleness = url.searchParams.get("staleness") ?? "any";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSizeRaw = Number.parseInt(url.searchParams.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (q) {
      conditions.push(`(lower(title) like $${idx} or lower(slug) like $${idx})`);
      params.push(`%${q}%`);
      idx += 1;
    }
    if (filter === "featured") conditions.push("is_featured = true");
    if (filter === "hidden") conditions.push("is_hidden = true");
    if (staleness === "stale") {
      conditions.push(`(last_synced_at is null or last_synced_at < now() - interval '${STALE_HOURS} hours')`);
    } else if (staleness === "fresh") {
      conditions.push(`last_synced_at >= now() - interval '${STALE_HOURS} hours'`);
    } else if (staleness === "never") {
      conditions.push("last_synced_at is null");
    }
    const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";

    const sql = createSqlClient();
    const totalRows = (await sql.query(
      `select count(*)::int as total from games ${whereClause}`,
      params
    )) as { total: number }[];
    const total = totalRows[0]?.total ?? 0;

    const games = (await sql.query(
      `select id, slug, title, cover_url, status, user_score, popularity_score, last_synced_at,
              is_featured, featured_rank, is_hidden, hidden_reason
       from games
       ${whereClause}
       order by popularity_score desc nulls last, title asc
       limit $${idx} offset $${idx + 1}`,
      [...params, pageSize, offset]
    )) as Array<{
      id: string;
      slug: string;
      title: string;
      cover_url: string | null;
      status: string | null;
      user_score: number | null;
      popularity_score: number | null;
      last_synced_at: string | null;
      is_featured: boolean;
      featured_rank: number | null;
      is_hidden: boolean;
      hidden_reason: string | null;
    }>;

    return jsonOk({
      games: games.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        coverUrl: row.cover_url,
        status: row.status,
        userScore: row.user_score,
        popularityScore: row.popularity_score,
        lastSyncedAt: row.last_synced_at,
        isFeatured: row.is_featured,
        featuredRank: row.featured_rank,
        isHidden: row.is_hidden,
        hiddenReason: row.hidden_reason
      })),
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) }
    });
  } catch (error) {
    log.error("games list failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudieron cargar los juegos.", 500);
  }
}

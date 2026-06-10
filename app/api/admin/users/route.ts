import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/users");
const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const filter = url.searchParams.get("filter") ?? "all";
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
    );
    const pageSizeRaw =
      Number.parseInt(
        url.searchParams.get("pageSize") ?? String(PAGE_SIZE),
        10,
      ) || PAGE_SIZE;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let placeholderIdx = 1;

    if (q) {
      conditions.push(
        `(lower(coalesce(u.email, p.username || '@mock.gameindex.local')) like $${placeholderIdx} or lower(p.username) like $${placeholderIdx} or lower(coalesce(p.display_name, '')) like $${placeholderIdx})`,
      );
      params.push(`%${q}%`);
      placeholderIdx += 1;
    }

    if (filter === "banned") {
      conditions.push("false");
    }

    const whereClause = conditions.length
      ? `where ${conditions.join(" and ")}`
      : "";

    const sql = createSqlClient();

    const countRows = (await sql.query(
      `select count(*)::int as total
       from profiles p
       left join app_users u on u.id = p.id
       ${whereClause}`,
      params,
    )) as { total: number }[];
    const total = countRows[0]?.total ?? 0;

    const usersRows = (await sql.query(
      `select p.id,
              coalesce(u.email, p.username || '@mock.gameindex.local') as email,
              p.username,
              p.display_name,
              p.created_at,
       from profiles p
       left join app_users u on u.id = p.id
       ${whereClause}
       order by p.created_at desc
       limit $${placeholderIdx} offset $${placeholderIdx + 1}`,
      [...params, pageSize, offset],
    )) as Array<{
      id: string;
      email: string;
      username: string;
      display_name: string | null;
      created_at: string;
    }>;

    const ids = usersRows.map((row) => row.id);
    let reviewCounts = new Map<string, number>();
    if (ids.length) {
      const counts = (await sql.query(
        "select user_id, count(*)::int as n from reviews where user_id = any($1::uuid[]) group by user_id",
        [ids],
      )) as Array<{ user_id: string; n: number }>;
      reviewCounts = new Map(counts.map((row) => [row.user_id, row.n]));
    }

    const users = usersRows.map((row) => ({
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.display_name ?? row.username,
      createdAt: row.created_at,
      isAdmin: false,
      banned: null,
      reviewCount: reviewCounts.get(row.id) ?? 0,
    }));

    return jsonOk({
      users,
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    log.error("users list failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError("No se pudieron cargar los usuarios.", 500);
  }
}

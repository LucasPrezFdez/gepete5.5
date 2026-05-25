import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/reports");

const STATUS_VALUES = ["pending", "resolved", "dismissed"] as const;
const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const statusParam = (url.searchParams.get("status") ?? "pending").toLowerCase();
    const status = STATUS_VALUES.includes(statusParam as any) ? (statusParam as (typeof STATUS_VALUES)[number]) : "pending";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSizeRaw = Number.parseInt(url.searchParams.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const sql = createSqlClient();
    const totalRows = (await sql.query(
      "select count(*)::int as total from content_reports where status = $1",
      [status]
    )) as { total: number }[];
    const total = totalRows[0]?.total ?? 0;

    const rows = (await sql.query(
      `select id, reporter_user_id, target_type, target_id, reason, details, status, resolved_by, resolved_at, resolution_note, created_at
       from content_reports
       where status = $1
       order by created_at desc
       limit $2 offset $3`,
      [status, pageSize, offset]
    )) as Array<{
      id: string;
      reporter_user_id: string | null;
      target_type: string;
      target_id: string;
      reason: string;
      details: string | null;
      status: string;
      resolved_by: string | null;
      resolved_at: string | null;
      resolution_note: string | null;
      created_at: string;
    }>;

    const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_user_id).filter(Boolean) as string[]));
    let reporters = new Map<string, { username: string; displayName: string }>();
    if (reporterIds.length) {
      const reporterRows = (await sql.query(
        "select id, username, display_name from app_users where id = any($1::uuid[])",
        [reporterIds]
      )) as Array<{ id: string; username: string; display_name: string | null }>;
      reporters = new Map(
        reporterRows.map((row) => [row.id, { username: row.username, displayName: row.display_name ?? row.username }])
      );
    }

    return jsonOk({
      reports: rows.map((row) => ({
        id: row.id,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        resolutionNote: row.resolution_note,
        reporter: row.reporter_user_id ? reporters.get(row.reporter_user_id) ?? null : null
      })),
      pagination: {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (error) {
    log.error("reports list failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudieron cargar los reportes.", 500);
  }
}

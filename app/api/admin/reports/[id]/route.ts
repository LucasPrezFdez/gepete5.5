import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";
import { logAdminAction } from "@/services/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/reports/[id]");

type Params = Promise<{ id: string }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HIDDEN_TABLES: Record<string, string> = {
  review: "reviews",
  list: "lists",
  comment: "ratings"
};

const patchSchema = {
  action: v.enum(["resolve", "dismiss"] as const),
  hideContent: v.boolean({ defaultValue: false }),
  banAuthor: v.boolean({ defaultValue: false }),
  banDurationHours: v.integer({ min: 1, max: 24 * 365 * 10, optional: true }),
  reason: v.string({ max: 240, optional: true }),
  resolutionNote: v.string({ max: 500, optional: true })
};

export async function GET(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return jsonError("Identificador no válido.", 400);

  try {
    const sql = createSqlClient();
    const rows = (await sql.query(
      `select id, reporter_user_id, target_type, target_id, reason, details, status, resolved_by, resolved_at, resolution_note, created_at
       from content_reports where id = $1 limit 1`,
      [id]
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
    if (!rows.length) return jsonError("Reporte no encontrado.", 404);
    const row = rows[0];

    const reporter = row.reporter_user_id ? await loadUserPreview(sql, row.reporter_user_id) : null;
    const target = await loadTargetPreview(sql, row.target_type, row.target_id);

    return jsonOk({
      report: {
        id: row.id,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        resolutionNote: row.resolution_note,
        reporter,
        target
      }
    });
  } catch (error) {
    log.error("report detail failed", { error: error instanceof Error ? error.message : String(error), id });
    return jsonError("No se pudo cargar el reporte.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;
  const admin = auth.user!;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return jsonError("Identificador no válido.", 400);

  const body = await parseBody(patchSchema, request);
  if (!body.ok) return jsonError(body.error, 400);
  const { action, hideContent, banAuthor, banDurationHours, reason, resolutionNote } = body.value;

  try {
    const sql = createSqlClient();
    const reportRows = (await sql.query(
      "select id, status, target_type, target_id from content_reports where id = $1 limit 1",
      [id]
    )) as Array<{ id: string; status: string; target_type: string; target_id: string }>;
    if (!reportRows.length) return jsonError("Reporte no encontrado.", 404);
    const report = reportRows[0];

    if (report.status !== "pending") {
      return jsonError("Este reporte ya estaba resuelto.", 409);
    }

    const nextStatus = action === "resolve" ? "resolved" : "dismissed";
    const note = resolutionNote?.trim() || null;
    const hidePayload = { applied: false, reason: reason?.trim() || null };
    const banPayload = { applied: false, until: null as string | null };

    if (hideContent && action === "resolve") {
      const table = HIDDEN_TABLES[report.target_type];
      if (!table) {
        return jsonError(`No se puede ocultar contenido de tipo "${report.target_type}".`, 400);
      }
      await sql.query(
        `update ${table} set hidden_at = now(), hidden_reason = $2, hidden_by = $3 where id = $1`,
        [report.target_id, hidePayload.reason, admin.id]
      );
      hidePayload.applied = true;
    }

    if (banAuthor && action === "resolve") {
      const authorId = await resolveAuthorId(sql, report.target_type, report.target_id);
      if (!authorId) {
        return jsonError("No se pudo localizar al autor para banearlo.", 400);
      }
      if (authorId === admin.id) {
        return jsonError("No puedes banearte a ti mismo.", 400);
      }
      const authorIsAdminRows = (await sql.query(
        "select is_admin from app_users where id = $1 limit 1",
        [authorId]
      )) as Array<{ is_admin: boolean }>;
      if (authorIsAdminRows[0]?.is_admin) {
        return jsonError("No puedes banear a otro administrador.", 400);
      }
      const until = banDurationHours
        ? new Date(Date.now() + banDurationHours * 60 * 60 * 1000).toISOString()
        : null;
      await sql.query(
        `update app_users
         set banned_at = now(), banned_until = $2, banned_reason = $3, banned_by = $4, updated_at = now()
         where id = $1`,
        [authorId, until, hidePayload.reason ?? "Por reporte de moderación", admin.id]
      );
      banPayload.applied = true;
      banPayload.until = until;
    }

    await sql.query(
      `update content_reports
       set status = $2, resolved_by = $3, resolved_at = now(), resolution_note = $4
       where id = $1`,
      [id, nextStatus, admin.id, note]
    );

    log.info("report resolved", {
      adminId: admin.id,
      reportId: id,
      action,
      hidden: hidePayload.applied,
      banned: banPayload.applied
    });
    await logAdminAction({
      admin: { id: admin.id, username: admin.user_metadata?.username },
      action: action === "resolve" ? "report.resolve" : "report.dismiss",
      targetType: "report",
      targetId: id,
      metadata: {
        reportTargetType: report.target_type,
        reportTargetId: report.target_id,
        hideContent: hidePayload.applied,
        banAuthor: banPayload.applied,
        banUntil: banPayload.until,
        note
      },
      request
    });

    return jsonOk({
      ok: true,
      report: { id, status: nextStatus, resolutionNote: note },
      hideContent: hidePayload,
      banAuthor: banPayload
    });
  } catch (error) {
    log.error("report patch failed", { error: error instanceof Error ? error.message : String(error), id });
    return jsonError("No se pudo actualizar el reporte.", 500);
  }
}

async function loadUserPreview(sql: ReturnType<typeof createSqlClient>, id: string) {
  const rows = (await sql.query(
    "select id, username, display_name from app_users where id = $1 limit 1",
    [id]
  )) as Array<{ id: string; username: string; display_name: string | null }>;
  if (!rows.length) return null;
  return { id: rows[0].id, username: rows[0].username, displayName: rows[0].display_name ?? rows[0].username };
}

async function loadTargetPreview(
  sql: ReturnType<typeof createSqlClient>,
  type: string,
  targetId: string
) {
  if (type === "review") {
    const rows = (await sql.query(
      `select r.id, r.user_id, r.title, r.body, r.score, r.has_spoilers, r.hidden_at, r.created_at,
              g.slug as game_slug, g.title as game_title
       from reviews r left join games g on g.id = r.game_id
       where r.id = $1 limit 1`,
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    const author = rows[0].user_id ? await loadUserPreview(sql, rows[0].user_id) : null;
    return {
      type,
      id: rows[0].id,
      author,
      hidden: Boolean(rows[0].hidden_at),
      createdAt: rows[0].created_at,
      title: rows[0].title,
      body: rows[0].body,
      score: rows[0].score,
      hasSpoilers: Boolean(rows[0].has_spoilers),
      gameSlug: rows[0].game_slug,
      gameTitle: rows[0].game_title
    };
  }

  if (type === "list") {
    const rows = (await sql.query(
      `select id, user_id, slug, title, description, hidden_at, created_at, likes_count
       from lists where id = $1 limit 1`,
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    const author = rows[0].user_id ? await loadUserPreview(sql, rows[0].user_id) : null;
    return {
      type,
      id: rows[0].id,
      author,
      hidden: Boolean(rows[0].hidden_at),
      createdAt: rows[0].created_at,
      slug: rows[0].slug,
      title: rows[0].title,
      description: rows[0].description,
      likesCount: rows[0].likes_count
    };
  }

  if (type === "comment") {
    const rows = (await sql.query(
      `select r.id, r.user_id, r.score, r.comment_body, r.hidden_at, r.created_at,
              g.slug as game_slug, g.title as game_title
       from ratings r left join games g on g.id = r.game_id
       where r.id = $1 limit 1`,
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    const author = rows[0].user_id ? await loadUserPreview(sql, rows[0].user_id) : null;
    return {
      type,
      id: rows[0].id,
      author,
      hidden: Boolean(rows[0].hidden_at),
      createdAt: rows[0].created_at,
      score: rows[0].score,
      body: rows[0].comment_body,
      gameSlug: rows[0].game_slug,
      gameTitle: rows[0].game_title
    };
  }

  if (type === "profile") {
    const rows = (await sql.query(
      `select p.id, p.username, p.display_name, p.bio, p.avatar_url, p.created_at,
              u.banned_at, u.banned_until
       from profiles p left join app_users u on u.id = p.id
       where p.id = $1 limit 1`,
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    return {
      type,
      id: rows[0].id,
      author: { id: rows[0].id, username: rows[0].username, displayName: rows[0].display_name ?? rows[0].username },
      hidden: false,
      createdAt: rows[0].created_at,
      bio: rows[0].bio,
      avatarUrl: rows[0].avatar_url,
      bannedUntil: rows[0].banned_until,
      isBanned: Boolean(rows[0].banned_at)
    };
  }

  if (type === "game") {
    const rows = (await sql.query(
      "select id, slug, title, summary, cover_url, is_hidden from games where id = $1 limit 1",
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    return {
      type,
      id: rows[0].id,
      author: null,
      hidden: Boolean(rows[0].is_hidden),
      slug: rows[0].slug,
      title: rows[0].title,
      summary: rows[0].summary,
      coverUrl: rows[0].cover_url
    };
  }

  return null;
}

async function resolveAuthorId(
  sql: ReturnType<typeof createSqlClient>,
  type: string,
  targetId: string
): Promise<string | null> {
  if (type === "review" || type === "list" || type === "comment") {
    const table = type === "comment" ? "ratings" : type === "review" ? "reviews" : "lists";
    const rows = (await sql.query(`select user_id from ${table} where id = $1 limit 1`, [targetId])) as Array<{ user_id: string | null }>;
    return rows[0]?.user_id ?? null;
  }
  if (type === "profile") return targetId;
  return null;
}

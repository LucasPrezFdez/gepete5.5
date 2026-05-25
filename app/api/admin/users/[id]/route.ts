import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/users/[id]");

type Params = Promise<{ id: string }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = {
  action: v.enum(["ban", "unban"] as const),
  reason: v.string({ max: 240, optional: true }),
  durationHours: v.integer({ min: 1, max: 24 * 365 * 10, optional: true })
};

export async function GET(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return jsonError("Identificador de usuario no válido.", 400);

  try {
    const sql = createSqlClient();

    const userRows = (await sql.query(
      `select id, email, username, display_name, created_at, updated_at, is_admin,
              banned_at, banned_until, banned_reason, banned_by
       from app_users where id = $1 limit 1`,
      [id]
    )) as Array<{
      id: string;
      email: string;
      username: string;
      display_name: string | null;
      created_at: string;
      updated_at: string;
      is_admin: boolean;
      banned_at: string | null;
      banned_until: string | null;
      banned_reason: string | null;
      banned_by: string | null;
    }>;

    if (!userRows.length) return jsonError("Usuario no encontrado.", 404);
    const user = userRows[0];

    const [reviewsCountRows, listsCountRows, ratingsCountRows, reportsAgainstRows, reportsByRows, recentReviewsRows, recentListsRows] =
      await Promise.all([
        sql.query("select count(*)::int as n from reviews where user_id = $1", [id]),
        sql.query("select count(*)::int as n from lists where user_id = $1", [id]),
        sql.query("select count(*)::int as n from ratings where user_id = $1", [id]),
        sql.query(
          `select count(*)::int as n from content_reports
           where target_type in ('review','list','profile','comment')
             and (
               (target_type = 'profile' and target_id = $1)
               or (target_type = 'review' and target_id in (select id from reviews where user_id = $1))
               or (target_type = 'list' and target_id in (select id from lists where user_id = $1))
               or (target_type = 'comment' and target_id in (select id from ratings where user_id = $1))
             )`,
          [id]
        ),
        sql.query("select count(*)::int as n from content_reports where reporter_user_id = $1", [id]),
        sql.query(
          `select id, title, score, created_at, hidden_at
           from reviews where user_id = $1 order by created_at desc limit 5`,
          [id]
        ),
        sql.query(
          `select id, slug, title, likes_count, created_at, hidden_at, is_public
           from lists where user_id = $1 order by created_at desc limit 5`,
          [id]
        )
      ]);

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name ?? user.username,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isAdmin: Boolean(user.is_admin),
        banned: user.banned_at
          ? {
              since: user.banned_at,
              until: user.banned_until,
              reason: user.banned_reason,
              by: user.banned_by
            }
          : null
      },
      counts: {
        reviews: (reviewsCountRows as any[])[0]?.n ?? 0,
        lists: (listsCountRows as any[])[0]?.n ?? 0,
        comments: (ratingsCountRows as any[])[0]?.n ?? 0,
        reportsReceived: (reportsAgainstRows as any[])[0]?.n ?? 0,
        reportsSubmitted: (reportsByRows as any[])[0]?.n ?? 0
      },
      recent: {
        reviews: (recentReviewsRows as any[]).map((row) => ({
          id: row.id,
          title: row.title,
          score: row.score,
          createdAt: row.created_at,
          hidden: Boolean(row.hidden_at)
        })),
        lists: (recentListsRows as any[]).map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          likesCount: row.likes_count,
          createdAt: row.created_at,
          hidden: Boolean(row.hidden_at),
          isPublic: Boolean(row.is_public)
        }))
      }
    });
  } catch (error) {
    log.error("user detail failed", { error: error instanceof Error ? error.message : String(error), id });
    return jsonError("No se pudo cargar el usuario.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;
  const admin = auth.user!;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return jsonError("Identificador de usuario no válido.", 400);

  const body = await parseBody(patchSchema, request);
  if (!body.ok) return jsonError(body.error, 400);

  if (id === admin.id) {
    return jsonError("No puedes banear tu propia cuenta de admin.", 400);
  }

  try {
    const sql = createSqlClient();
    const existing = (await sql.query(
      "select id, is_admin from app_users where id = $1 limit 1",
      [id]
    )) as Array<{ id: string; is_admin: boolean }>;
    if (!existing.length) return jsonError("Usuario no encontrado.", 404);

    if (body.value.action === "ban") {
      if (existing[0].is_admin) {
        return jsonError("No puedes banear a otro administrador.", 400);
      }
      const reason = body.value.reason?.trim() || null;
      const until = body.value.durationHours
        ? new Date(Date.now() + body.value.durationHours * 60 * 60 * 1000).toISOString()
        : null;
      await sql.query(
        `update app_users
         set banned_at = now(), banned_until = $2, banned_reason = $3, banned_by = $4, updated_at = now()
         where id = $1`,
        [id, until, reason, admin.id]
      );
      log.info("user banned", { adminId: admin.id, targetId: id, until, reason });
      return jsonOk({ ok: true, banned: { since: new Date().toISOString(), until, reason, by: admin.id } });
    }

    if (body.value.action === "unban") {
      await sql.query(
        `update app_users
         set banned_at = null, banned_until = null, banned_reason = null, banned_by = null, updated_at = now()
         where id = $1`,
        [id]
      );
      log.info("user unbanned", { adminId: admin.id, targetId: id });
      return jsonOk({ ok: true, banned: null });
    }

    return jsonError("Acción no soportada.", 400);
  } catch (error) {
    log.error("user patch failed", { error: error instanceof Error ? error.message : String(error), id });
    return jsonError("No se pudo actualizar el usuario.", 500);
  }
}

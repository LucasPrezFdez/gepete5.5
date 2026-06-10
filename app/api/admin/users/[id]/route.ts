import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";
import { logAdminAction } from "@/services/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/users/[id]");

type Params = Promise<{ id: string }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = {
  action: v.enum(["ban", "unban"] as const),
  reason: v.string({ max: 240, optional: true }),
  durationHours: v.integer({ min: 1, max: 24 * 365 * 10, optional: true }),
};

export async function GET(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return jsonError("Identificador de usuario no válido.", 400);

  try {
    const sql = createSqlClient();

    const userRows = (await sql.query(
      `select p.id,
              coalesce(u.email, p.username || '@mock.gameindex.local') as email,
              p.username,
              p.display_name,
              p.created_at,
              p.updated_at,
       from profiles p
       left join app_users u on u.id = p.id
       where p.id = $1
       limit 1`,
      [id],
    )) as Array<{
      id: string;
      email: string;
      username: string;
      display_name: string | null;
      created_at: string;
      updated_at: string;
    }>;

    if (!userRows.length) return jsonError("Usuario no encontrado.", 404);
    const user = userRows[0];

    const [
      reviewsCountRows,
      listsCountRows,
      ratingsCountRows,
      reportsAgainstRows,
      reportsByRows,
      recentReviewsRows,
      recentListsRows,
    ] = await Promise.all([
      sql.query("select count(*)::int as n from reviews where user_id = $1", [
        id,
      ]),
      sql.query("select count(*)::int as n from lists where user_id = $1", [
        id,
      ]),
      sql.query("select count(*)::int as n from ratings where user_id = $1", [
        id,
      ]),
      sql.query(
        `select count(*)::int as n from content_reports
           where target_type in ('review','list','profile','comment')
             and (
               (target_type = 'profile' and target_id = $1)
               or (target_type = 'review' and target_id in (select id from reviews where user_id = $1))
               or (target_type = 'list' and target_id in (select id from lists where user_id = $1))
               or (target_type = 'comment' and target_id in (select id from ratings where user_id = $1))
             )`,
        [id],
      ),
      sql.query(
        "select count(*)::int as n from content_reports where reporter_user_id = $1",
        [id],
      ),
      sql.query(
        `select id, title, score, created_at, hidden_at
           from reviews where user_id = $1 order by created_at desc limit 5`,
        [id],
      ),
      sql.query(
        `select id, slug, title, likes_count, created_at, hidden_at, is_public
           from lists where user_id = $1 order by created_at desc limit 5`,
        [id],
      ),
    ]);

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name ?? user.username,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isAdmin: false,
        banned: null,
      },
      counts: {
        reviews: (reviewsCountRows as any[])[0]?.n ?? 0,
        lists: (listsCountRows as any[])[0]?.n ?? 0,
        comments: (ratingsCountRows as any[])[0]?.n ?? 0,
        reportsReceived: (reportsAgainstRows as any[])[0]?.n ?? 0,
        reportsSubmitted: (reportsByRows as any[])[0]?.n ?? 0,
      },
      recent: {
        reviews: (recentReviewsRows as any[]).map((row) => ({
          id: row.id,
          title: row.title,
          score: row.score,
          createdAt: row.created_at,
          hidden: Boolean(row.hidden_at),
        })),
        lists: (recentListsRows as any[]).map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          likesCount: row.likes_count,
          createdAt: row.created_at,
          hidden: Boolean(row.hidden_at),
          isPublic: Boolean(row.is_public),
        })),
      },
    });
  } catch (error) {
    log.error("user detail failed", {
      error: error instanceof Error ? error.message : String(error),
      id,
    });
    return jsonError("No se pudo cargar el usuario.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;
  const admin = auth.user!;

  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return jsonError("Identificador de usuario no válido.", 400);

  const body = await parseBody(patchSchema, request);
  if (!body.ok) return jsonError(body.error, 400);

  if (id === admin.id) {
    return jsonError("No puedes modificar tu propia cuenta de admin.", 400);
  }

  try {
    const sql = createSqlClient();
    const existing = (await sql.query(
      "select id, username from app_users where id = $1 limit 1",
      [id],
    )) as Array<{ id: string; username: string }>;
    if (!existing.length) return jsonError("Usuario no encontrado.", 404);

    if (body.value.action === "ban") {
      return jsonError(
        "La base actual no expone campos de suspensión para usuarios.",
        400,
      );
    }

    if (body.value.action === "unban") {
      return jsonError(
        "La base actual no expone campos de suspensión para usuarios.",
        400,
      );
    }

    return jsonError("Acción no soportada.", 400);
  } catch (error) {
    log.error("user patch failed", {
      error: error instanceof Error ? error.message : String(error),
      id,
    });
    return jsonError("No se pudo actualizar el usuario.", 500);
  }
}

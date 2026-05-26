import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";
import { logAdminAction, type AdminAuditTargetType } from "@/services/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/content/hide");

const HIDDEN_TABLES: Record<string, string> = {
  review: "reviews",
  list: "lists",
  comment: "ratings"
};

const schema = {
  type: v.enum(["review", "list", "comment"] as const),
  id: v.string({ min: 1, max: 64 }),
  reason: v.string({ max: 240, optional: true })
};

export async function POST(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;
  const admin = auth.user!;

  const body = await parseBody(schema, request);
  if (!body.ok) return jsonError(body.error, 400);
  const table = HIDDEN_TABLES[body.value.type];
  if (!table) return jsonError("Tipo de contenido no soportado.", 400);

  try {
    const sql = createSqlClient();
    const rows = (await sql.query(`select id from ${table} where id = $1 limit 1`, [body.value.id])) as Array<{ id: string }>;
    if (!rows.length) return jsonError("Contenido no encontrado.", 404);

    const reason = body.value.reason?.trim() || null;
    await sql.query(
      `update ${table} set hidden_at = now(), hidden_reason = $2, hidden_by = $3 where id = $1`,
      [body.value.id, reason, admin.id]
    );
    log.info("content hidden", { type: body.value.type, id: body.value.id, adminId: admin.id });
    await logAdminAction({
      admin: { id: admin.id, username: admin.user_metadata?.username },
      action: "content.hide",
      targetType: body.value.type as AdminAuditTargetType,
      targetId: body.value.id,
      metadata: { reason },
      request
    });
    return jsonOk({ ok: true });
  } catch (error) {
    log.error("hide failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudo ocultar el contenido.", 500);
  }
}

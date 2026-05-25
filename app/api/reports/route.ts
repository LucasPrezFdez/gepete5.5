import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { createSqlClient } from "@/services/database";
import { requireActiveUserFromRequest } from "@/services/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/reports");

const TARGET_TYPES = ["review", "list", "profile", "comment", "game"] as const;
const REASONS = ["spam", "harassment", "spoiler", "offensive", "inaccurate", "other"] as const;

const schema = {
  target_type: v.enum(TARGET_TYPES),
  target_id: v.string({ min: 1, max: 64 }),
  reason: v.enum(REASONS),
  details: v.string({ max: 500, optional: true })
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await requireActiveUserFromRequest(request);
  if (auth.response) return auth.response;
  const reporterId = auth.user!.id;

  const limit = checkRateLimit(`reports:${reporterId}`, 3, 60);
  if (!limit.allowed) {
    return jsonError("Has reportado demasiado contenido en poco tiempo. Inténtalo más tarde.", 429, {
      retryAfter: limit.retryAfterSeconds
    });
  }

  const parsed = await parseBody(schema, request);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { target_type, target_id, reason, details } = parsed.value;

  if (!UUID_PATTERN.test(target_id)) {
    return jsonError("El identificador del contenido no es válido.", 400);
  }

  const sql = createSqlClient();
  const targetCheck = await verifyTarget(sql, target_type, target_id);
  if (!targetCheck.exists) {
    return jsonError("El contenido reportado ya no existe.", 404);
  }
  if (targetCheck.ownerId && targetCheck.ownerId === reporterId) {
    return jsonError("No puedes reportar tu propio contenido.", 400);
  }

  const existing = await sql.query(
    `select id from content_reports
     where reporter_user_id = $1 and target_type = $2 and target_id = $3 and status = 'pending'
     limit 1`,
    [reporterId, target_type, target_id]
  ) as { id: string }[];

  if (existing.length) {
    return jsonOk({ report: { id: existing[0].id }, already: true });
  }

  const rows = await sql.query(
    `insert into content_reports (reporter_user_id, target_type, target_id, reason, details)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [reporterId, target_type, target_id, reason, details ?? null]
  ) as { id: string }[];

  log.info("report created", {
    id: rows[0]?.id,
    target_type,
    target_id,
    reporter: reporterId,
    reason
  });

  return jsonOk({ report: { id: rows[0]?.id ?? null }, already: false });
}

type TargetCheck = { exists: boolean; ownerId: string | null };

async function verifyTarget(
  sql: ReturnType<typeof createSqlClient>,
  type: (typeof TARGET_TYPES)[number],
  id: string
): Promise<TargetCheck> {
  if (type === "review" || type === "list" || type === "comment") {
    const table = type === "comment" ? "ratings" : type === "review" ? "reviews" : "lists";
    const rows = await sql.query(
      `select user_id from ${table} where id = $1 limit 1`,
      [id]
    ) as { user_id: string | null }[];
    if (!rows.length) return { exists: false, ownerId: null };
    return { exists: true, ownerId: rows[0].user_id ?? null };
  }

  if (type === "profile") {
    const rows = await sql.query(
      "select id from profiles where id = $1 limit 1",
      [id]
    ) as { id: string }[];
    if (!rows.length) return { exists: false, ownerId: null };
    return { exists: true, ownerId: rows[0].id };
  }

  if (type === "game") {
    const rows = await sql.query(
      "select id from games where id = $1 limit 1",
      [id]
    ) as { id: string }[];
    return { exists: rows.length > 0, ownerId: null };
  }

  return { exists: false, ownerId: null };
}

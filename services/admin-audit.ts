import { createLogger } from "@/lib/logger";
import { createSqlClient } from "@/services/database";
import type { AuthUser } from "@/services/auth-types";

const log = createLogger("services/admin-audit");

export type AdminAuditAction =
  | "user.ban"
  | "user.unban"
  | "user.promote"
  | "user.demote"
  | "content.hide"
  | "content.unhide"
  | "report.resolve"
  | "report.dismiss"
  | "game.resync"
  | "game.update"
  | "game.feature"
  | "cache.backfill"
  | "cache.bulk_resync"
  | "seed.fallback_users";

export type AdminAuditTargetType =
  | "user"
  | "review"
  | "list"
  | "rating"
  | "comment"
  | "profile"
  | "report"
  | "game"
  | "cache"
  | "job";

export type LogAdminActionInput = {
  admin: Pick<AuthUser, "id"> & { username?: string };
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
};

export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  try {
    const sql = createSqlClient();
    await sql.query(
      `insert into admin_audit_log
         (admin_id, admin_username, action, target_type, target_id, target_label, metadata, ip_address)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        input.admin.id,
        input.admin.username ?? null,
        input.action,
        input.targetType,
        input.targetId ?? null,
        input.targetLabel ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.request ? getClientIp(input.request) : null
      ]
    );
  } catch (error) {
    log.warn("failed to write audit log", {
      error: error instanceof Error ? error.message : String(error),
      action: input.action
    });
  }
}

export type AuditLogEntry = {
  id: string;
  adminId: string | null;
  adminUsername: string | null;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
};

export type ListAuditOptions = {
  limit?: number;
  offset?: number;
  action?: AdminAuditAction;
  adminId?: string;
  targetType?: AdminAuditTargetType;
};

export type AuditLogPage = {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
};

export async function listAuditLog(options: ListAuditOptions = {}): Promise<AuditLogPage> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const sql = createSqlClient();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.action) {
    params.push(options.action);
    conditions.push(`action = $${params.length}`);
  }
  if (options.adminId) {
    params.push(options.adminId);
    conditions.push(`admin_id = $${params.length}`);
  }
  if (options.targetType) {
    params.push(options.targetType);
    conditions.push(`target_type = $${params.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const rowsParams = [...params, limit, offset];
  const rows = (await sql.query(
    `select id, admin_id, admin_username, action, target_type, target_id, target_label,
            metadata, ip_address, created_at
     from admin_audit_log
     ${where}
     order by created_at desc
     limit $${rowsParams.length - 1} offset $${rowsParams.length}`,
    rowsParams
  )) as Array<{
    id: string;
    admin_id: string | null;
    admin_username: string | null;
    action: AdminAuditAction;
    target_type: AdminAuditTargetType;
    target_id: string | null;
    target_label: string | null;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
  }>;

  const totalRows = (await sql.query(
    `select count(*)::int as count from admin_audit_log ${where}`,
    params
  )) as Array<{ count: number }>;

  return {
    entries: rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      adminUsername: row.admin_username,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      targetLabel: row.target_label,
      metadata: row.metadata ?? {},
      ipAddress: row.ip_address,
      createdAt: row.created_at
    })),
    total: totalRows[0]?.count ?? 0,
    limit,
    offset
  };
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

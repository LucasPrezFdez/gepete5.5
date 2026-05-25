import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { forceResyncGameBySlug } from "@/services/games";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/games/[slug]/resync");

type Params = Promise<{ slug: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  const { slug } = await params;
  if (!slug?.trim()) return jsonError("Slug requerido.", 400);

  try {
    const result = await forceResyncGameBySlug(slug);
    if (!result.ok) {
      log.warn("resync failed", { slug, error: result.error });
      return jsonError(result.error ?? "No se pudo resincronizar el juego.", 502);
    }

    const sql = createSqlClient();
    const rows = (await sql.query(
      "select last_synced_at from games where slug = $1 limit 1",
      [slug]
    )) as Array<{ last_synced_at: string | null }>;

    log.info("game resynced", { adminId: auth.user!.id, slug, source: result.source });
    return jsonOk({
      ok: true,
      source: result.source,
      lastSyncedAt: rows[0]?.last_synced_at ?? null
    });
  } catch (error) {
    log.error("resync error", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("Error inesperado al resincronizar.", 500);
  }
}

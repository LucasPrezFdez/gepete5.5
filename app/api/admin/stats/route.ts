import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { loadAdminStats } from "@/services/admin-stats";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/stats");

export async function GET(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  try {
    const data = await loadAdminStats();
    return jsonOk(data);
  } catch (error) {
    log.error("stats failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudieron cargar las estadísticas.", 500);
  }
}

import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { createJob, runBulkResyncJob } from "@/services/admin-jobs";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/cache/bulk-resync");
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function POST(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  let limit = DEFAULT_LIMIT;
  try {
    const body = await request.json().catch(() => null);
    const requested = Number((body as any)?.limit);
    if (Number.isFinite(requested) && requested > 0) {
      limit = Math.min(MAX_LIMIT, Math.floor(requested));
    }
  } catch {
    /* no-op */
  }

  try {
    const jobId = await createJob("bulk_resync", auth.user!.id);
    log.info("bulk_resync job created", { jobId, limit, adminId: auth.user!.id });
    void runBulkResyncJob(jobId, limit);
    return jsonOk({ jobId, limit });
  } catch (error) {
    log.error("could not start job", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudo lanzar el job.", 500);
  }
}

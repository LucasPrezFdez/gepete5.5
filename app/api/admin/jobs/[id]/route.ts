import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/services/community";
import { getJob } from "@/services/admin-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return jsonError("Identificador no válido.", 400);

  const job = await getJob(id);
  if (!job) return jsonError("Job no encontrado.", 404);
  return jsonOk({ job });
}

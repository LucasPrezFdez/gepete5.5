import { jsonError, jsonOk } from "@/lib/api";
import { createLogger } from "@/lib/logger";
import { getUserFromRequest } from "@/services/community";
import { getRecommendationsForUser } from "@/services/recommendations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("api/me/recommendations");

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REFRESH_MAX = 6;
const RATE_LIMIT_GET_MAX = 60;
const rateBuckets = new Map<string, { count: number; resetAt: number; kind: "get" | "refresh" }>();

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return jsonError(auth.error ?? "Debes iniciar sesión.", 401);

  const rate = takeRateToken(auth.user.id, "get");
  if (!rate.ok) {
    return jsonError(
      `Demasiadas peticiones. Vuelve a intentarlo en ${rate.retryAfterSec}s.`,
      429,
      { retryAfter: rate.retryAfterSec }
    );
  }

  try {
    const result = await getRecommendationsForUser(auth.user.id, { force: false });
    return jsonOk(result);
  } catch (error) {
    log.error("failed to load recommendations", { error });
    return jsonError("No se pudieron cargar las recomendaciones.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth.user) return jsonError(auth.error ?? "Debes iniciar sesión.", 401);

  const rate = takeRateToken(auth.user.id, "refresh");
  if (!rate.ok) {
    return jsonError(
      `Has refrescado demasiadas veces. Espera ${rate.retryAfterSec}s.`,
      429,
      { retryAfter: rate.retryAfterSec }
    );
  }

  try {
    const result = await getRecommendationsForUser(auth.user.id, { force: true });
    return jsonOk(result);
  } catch (error) {
    log.error("failed to refresh recommendations", { error });
    return jsonError("No se pudieron generar las recomendaciones.", 500);
  }
}

function takeRateToken(key: string, kind: "get" | "refresh") {
  const now = Date.now();
  const bucketKey = `${kind}:${key}`;
  const max = kind === "refresh" ? RATE_LIMIT_REFRESH_MAX : RATE_LIMIT_GET_MAX;

  const bucket = rateBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS, kind });
    return { ok: true as const };
  }
  if (bucket.count >= max) {
    return {
      ok: false as const,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }
  bucket.count++;
  return { ok: true as const };
}

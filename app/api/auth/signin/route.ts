import { authenticateUser } from "@/services/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/auth/signin");

const schema = {
  email: v.email(),
  password: v.string({ min: 1, max: 200, trim: false })
};

export async function POST(request: Request) {
  const limit = checkRateLimit(getRateLimitKey(request, "auth:signin"), 8, 60);
  if (!limit.allowed) {
    return jsonError("Demasiados intentos. Espera unos segundos antes de reintentar.", 429, {
      retryAfter: limit.retryAfterSeconds
    });
  }

  const result = await parseBody(schema, request);
  if (!result.ok) return jsonError(result.error, 400);

  try {
    const session = await authenticateUser(result.value);
    return jsonOk({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    log.warn("signin failed", { reason: message });
    return jsonError(message, 401);
  }
}

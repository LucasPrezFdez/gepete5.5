import { registerUser } from "@/services/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/auth/signup");

const schema = {
  email: v.email(),
  password: v.string({ min: 6, max: 200, trim: false }),
  username: v.string({ min: 2, max: 32, optional: true })
};

export async function POST(request: Request) {
  const limit = checkRateLimit(getRateLimitKey(request, "auth:signup"), 5, 60);
  if (!limit.allowed) {
    return jsonError("Has creado demasiadas cuentas en poco tiempo. Inténtalo más tarde.", 429, {
      retryAfter: limit.retryAfterSeconds
    });
  }

  const result = await parseBody(schema, request);
  if (!result.ok) return jsonError(result.error, 400);

  try {
    const session = await registerUser(result.value);
    return jsonOk({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la cuenta.";
    log.warn("signup failed", { reason: message });
    return jsonError(message, 400);
  }
}

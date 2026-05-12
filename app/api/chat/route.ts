import { jsonError } from "@/lib/api";
import { createLogger } from "@/lib/logger";
import { getExploreGames, getGameBySlug, getSimilarGames } from "@/services/games";
import { getOptionalUserIdFromRequest } from "@/services/community";
import { createServiceDatabaseClient } from "@/services/database";
import type { Game, GameSort } from "@/data/games";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("api/chat");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 4000;
const MAX_TOOL_ROUNDS = 3;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 40;
const RATE_BUCKET_SWEEP_THRESHOLD = 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

type ChatRole = "user" | "assistant" | "tool" | "system";
type ChatMessage = {
  role: ChatRole;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_games",
      description:
        "Busca en el catálogo de GameIndex (IGDB/RAWG/Neon). Útil para próximos lanzamientos, novedades, top de un género, buscar un título, etc. Devuelve una lista de juegos.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto libre (título). Opcional." },
          sort: {
            type: "string",
            enum: ["popular", "score", "recent", "upcoming", "reviewed"],
            description:
              "'upcoming' para próximos lanzamientos, 'recent' para novedades, 'score' para mejor valorados, 'popular' para más populares, 'reviewed' para más reseñados."
          },
          platform: { type: "string", description: "Ej. 'PC', 'PlayStation 5'." },
          genre: { type: "string", description: "Ej. 'RPG', 'Shooter', 'Indie'." },
          year: { type: ["integer", "string"], description: "Año de lanzamiento (número, p. ej. 2026)." },
          limit: { type: ["integer", "string"], description: "Resultados, número entero entre 1 y 15. Por defecto 8." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_game_details",
      description:
        "Ficha completa de un juego concreto por slug. Úsalo cuando necesites sinopsis, fecha exacta, desarrolladora, plataformas, puntuaciones, géneros, modos.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Slug del juego (devuelto por search_games)." }
        },
        required: ["slug"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_similar_games",
      description:
        "Devuelve juegos similares a uno dado por slug. Útil para 'recomiéndame algo como X'.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Slug del juego de referencia." },
          limit: { type: ["integer", "string"], description: "Número entero entre 1 y 10. Por defecto 6." }
        },
        required: ["slug"]
      }
    }
  }
] as const;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    log.warn("missing GROQ_API_KEY");
    return jsonError("El chat no está configurado en el servidor.", 503);
  }

  const ip = getClientIp(request);
  const rate = takeRateToken(ip);
  if (!rate.ok) {
    return jsonError(
      `Has hecho demasiadas preguntas. Vuelve a intentarlo en ${rate.retryAfterSec}s.`,
      429,
      { retryAfter: rate.retryAfterSec }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Cuerpo de la petición inválido.", 400);
  }

  const incoming = parseMessages(payload);
  if (!incoming) return jsonError("Mensajes inválidos.", 400);
  if (incoming.length === 0) return jsonError("No hay mensajes que procesar.", 400);

  const userContext = await buildUserContext(request);
  const systemPrompt = buildSystemPrompt(userContext);
  const conversation: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...incoming];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: { type: string; [k: string]: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial padding + open event forces browsers and any intermediate proxies to flush the
      // stream before the first real chunk arrives. Without this, the dev server can buffer the
      // response while the user sees an empty bubble.
      controller.enqueue(encoder.encode(`: ${" ".repeat(2048)}\n\n`));
      send({ type: "open" });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // controller closed
        }
      }, 10_000);

      try {
        let emptyRetries = 0;
        let disableTools = false;
        let rescueUsed = false;
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const decision = await runOneStep(
            apiKey,
            conversation,
            send,
            disableTools || round === MAX_TOOL_ROUNDS - 1
          );

          if (decision.kind === "done") {
            send({ type: "done" });
            clearInterval(heartbeat);
            controller.close();
            return;
          }
          if (decision.kind === "error") {
            send({ type: "error", message: decision.message });
            clearInterval(heartbeat);
            controller.close();
            return;
          }
          if (decision.kind === "retry-no-tools") {
            // Tool-call validation failed. Try once to rescue: infer the user's intent from
            // the last message, invoke search_games ourselves, and inject the result as a
            // synthetic tool call + tool response so the model can write the final answer.
            // If rescue was already used (or doesn't apply), fall back to a tools-disabled retry.
            if (!rescueUsed) {
              const rescued = await attemptIntentRescue(conversation, send);
              if (rescued) {
                rescueUsed = true;
                continue;
              }
            }
            disableTools = true;
            continue;
          }
          if (decision.kind === "empty") {
            if (emptyRetries >= 1) {
              send({
                type: "error",
                message: "El asistente no devolvió respuesta. Intenta reformular la pregunta."
              });
              clearInterval(heartbeat);
              controller.close();
              return;
            }
            emptyRetries++;
            log.warn("groq returned empty response, nudging");
            conversation.push({
              role: "system",
              content:
                "Tu respuesta anterior estuvo vacía. Responde ahora al usuario en texto, usando las herramientas si necesitas datos del catálogo."
            });
            continue;
          }
          // kind === "tool" → loop continues with tool results already pushed into `conversation`
        }
        send({ type: "error", message: "El asistente no pudo completar la consulta." });
        clearInterval(heartbeat);
        controller.close();
      } catch (error) {
        log.error("chat stream failed", { error });
        clearInterval(heartbeat);
        try {
          send({ type: "error", message: "Error inesperado al consultar el asistente." });
        } catch {
          // controller may already be closed
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

type StepResult =
  | { kind: "done" }
  | { kind: "tool" }
  | { kind: "empty" }
  | { kind: "retry-no-tools" }
  | { kind: "error"; message: string };

async function runOneStep(
  apiKey: string,
  conversation: ChatMessage[],
  send: (event: { type: string; [k: string]: unknown }) => void,
  forceNoTools: boolean
): Promise<StepResult> {
  const requestBody = {
    model: DEFAULT_MODEL,
    temperature: 0.5,
    max_tokens: 900,
    messages: conversation,
    tools: forceNoTools ? undefined : TOOLS,
    tool_choice: forceNoTools ? undefined : "auto",
    stream: true
  };
  log.debug("groq request", {
    messageCount: conversation.length,
    withTools: !forceNoTools,
    lastRole: conversation[conversation.length - 1]?.role
  });
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    log.warn("groq error", { status: response.status, body: text.slice(0, 500) });
    if (response.status === 429) {
      return { kind: "error", message: "El proveedor LLM está saturado. Espera unos segundos." };
    }
    return { kind: "error", message: "El asistente no está disponible ahora mismo." };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  const toolCallsMap = new Map<
    number,
    { id: string; name: string; argumentsText: string }
  >();
  let finishReason: string | null = null;

  let upstreamError: string | null = null;
  let sawErrorEvent = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line.startsWith("event:")) {
        if (line.slice(6).trim() === "error") sawErrorEvent = true;
        continue;
      }
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      // Groq sends `event: error\ndata: {"error": {...}}` inline with the stream when something
      // like tool-call validation fails. The data line is parseable as JSON but doesn't have
      // a `choices` field — detect and surface it.
      if (sawErrorEvent || data.startsWith('{"error"')) {
        try {
          const parsed = JSON.parse(data);
          upstreamError = parsed?.error?.message || "Error del proveedor LLM.";
          log.warn("groq inline error", {
            error: upstreamError,
            code: parsed?.error?.code,
            failedGeneration: String(parsed?.error?.failed_generation ?? "").slice(0, 500)
          });
        } catch {
          upstreamError = "Error del proveedor LLM.";
          log.warn("groq inline error (unparseable)", { raw: data.slice(0, 500) });
        }
        continue;
      }

      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }

      const choice = json.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta ?? {};

      if (typeof delta.content === "string" && delta.content.length > 0) {
        assistantText += delta.content;
        send({ type: "delta", text: delta.content });
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const index = typeof tc.index === "number" ? tc.index : 0;
          const entry = toolCallsMap.get(index) ?? { id: "", name: "", argumentsText: "" };
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.argumentsText += tc.function.arguments;
          toolCallsMap.set(index, entry);
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  const toolCalls = Array.from(toolCallsMap.values()).filter((c) => c.id && c.name);

  log.debug("step finished", {
    finishReason,
    toolCallCount: toolCalls.length,
    textLength: assistantText.length,
    firstToolName: toolCalls[0]?.name,
    upstreamError
  });

  if (upstreamError) {
    // Tool-call validation errors are recoverable: tell the model to answer in plain text
    // without calling tools again. Other errors bubble up to the user.
    if (/tool|function/i.test(upstreamError)) {
      conversation.push({
        role: "system",
        content:
          "Tu última llamada a una herramienta falló por argumentos inválidos. NO vuelvas a llamar a ninguna herramienta. Responde al usuario directamente en texto con lo que sepas; si no tienes datos suficientes, dilo y sugiere consultar el catálogo manualmente."
      });
      return { kind: "retry-no-tools" };
    }
    return { kind: "error", message: "El asistente devolvió un error: " + upstreamError };
  }

  if (toolCalls.length === 0) {
    if (assistantText.length === 0) return { kind: "empty" };
    return { kind: "done" };
  }

  conversation.push({
    role: "assistant",
    content: assistantText || null,
    tool_calls: toolCalls.map((c) => ({
      id: c.id,
      type: "function",
      function: { name: c.name, arguments: c.argumentsText || "{}" }
    }))
  });

  for (const call of toolCalls) {
    send({ type: "tool", name: call.name });
    const result = await runTool(call.name, call.argumentsText);
    conversation.push({
      role: "tool",
      tool_call_id: call.id,
      name: call.name,
      content: JSON.stringify(result)
    });
  }

  // Acknowledge we'll continue. If finishReason was 'stop' without tools we'd have returned 'done' above.
  void finishReason;
  return { kind: "tool" };
}

async function runTool(name: string, rawArgs: string) {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { error: "Argumentos inválidos." };
  }

  if (name === "search_games") return searchGamesTool(args);
  if (name === "get_game_details") return getGameDetailsTool(args);
  if (name === "get_similar_games") return getSimilarGamesTool(args);
  return { error: `Herramienta desconocida: ${name}` };
}

async function searchGamesTool(args: Record<string, unknown>) {
  const limit = clampInt(args.limit, 8, 1, 15);
  const sort = parseSort(args.sort);
  const query = strOrUndefined(args.query);
  const platform = strOrUndefined(args.platform);
  const genre = strOrUndefined(args.genre);
  const year = clampInt(args.year, 0, 1970, 2100) || undefined;

  try {
    const result = await getExploreGames({ query, sort, platform, genre, year, pageSize: limit });
    return {
      count: result.count,
      source: result.source,
      games: result.games.slice(0, limit).map(summarizeGame),
      warning: result.error
    };
  } catch (error) {
    log.warn("search_games tool failed", { error });
    return { error: "No se pudo consultar el catálogo." };
  }
}

async function getGameDetailsTool(args: Record<string, unknown>) {
  const slug = strOrUndefined(args.slug);
  if (!slug) return { error: "Falta el parámetro slug." };
  try {
    const game = await getGameBySlug(slug);
    if (!game) return { error: "Juego no encontrado." };
    return { game: detailedGame(game) };
  } catch (error) {
    log.warn("get_game_details tool failed", { error });
    return { error: "No se pudo cargar la ficha del juego." };
  }
}

async function getSimilarGamesTool(args: Record<string, unknown>) {
  const slug = strOrUndefined(args.slug);
  const limit = clampInt(args.limit, 6, 1, 10);
  if (!slug) return { error: "Falta el parámetro slug." };
  try {
    const base = await getGameBySlug(slug);
    if (!base) return { error: "Juego de referencia no encontrado." };
    const similar = await getSimilarGames(base, limit);
    return {
      reference: { title: base.title, slug: base.slug },
      games: similar.map(summarizeGame)
    };
  } catch (error) {
    log.warn("get_similar_games tool failed", { error });
    return { error: "No se pudieron obtener juegos similares." };
  }
}

function summarizeGame(game: Game) {
  return {
    title: game.title,
    slug: game.slug,
    year: game.year || null,
    releaseDate: game.releaseDate,
    status: game.status,
    platforms: game.platforms.slice(0, 6),
    genres: game.genres.slice(0, 4),
    developer: game.developer,
    publisher: game.publisher,
    userScore: game.userScore || null,
    criticScore: game.criticScore,
    summary: truncate(game.summary, 220)
  };
}

function detailedGame(game: Game) {
  return {
    ...summarizeGame(game),
    summary: truncate(game.summary, 600),
    modes: game.modes
  };
}

function truncate(value: string, max: number) {
  if (!value) return "";
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}

type InferredIntent = {
  tool: "search_games";
  args: Record<string, unknown>;
};

const PLATFORM_KEYWORDS: Array<{ match: RegExp; value: string }> = [
  { match: /\b(ps5|playstation\s*5)\b/i, value: "PlayStation 5" },
  { match: /\b(ps4|playstation\s*4)\b/i, value: "PlayStation 4" },
  { match: /\b(xbox\s*series|series\s*x|series\s*s)\b/i, value: "Xbox Series X|S" },
  { match: /\b(xbox\s*one)\b/i, value: "Xbox One" },
  { match: /\b(switch|nintendo)\b/i, value: "Nintendo Switch" },
  { match: /\b(pc|steam|windows)\b/i, value: "PC (Microsoft Windows)" }
];

const GENRE_KEYWORDS: Array<{ match: RegExp; value: string }> = [
  { match: /\brpg\b|rol\b/i, value: "Role-playing (RPG)" },
  { match: /\bshooter|fps\b/i, value: "Shooter" },
  { match: /\bestrategia|strategy\b/i, value: "Strategy" },
  { match: /\bacci[oó]n|action\b/i, value: "Action" },
  { match: /\baventura|adventure\b/i, value: "Adventure" },
  { match: /\bplataformas|platformer\b/i, value: "Platform" },
  { match: /\bcarreras|racing\b/i, value: "Racing" },
  { match: /\bdeportes|sports\b/i, value: "Sport" },
  { match: /\bterror|horror\b/i, value: "Horror" },
  { match: /\bpuzzle\b/i, value: "Puzzle" },
  { match: /\bindie\b/i, value: "Indie" },
  { match: /\bsimulador|simulation\b/i, value: "Simulator" }
];

function inferIntentFromText(text: string): InferredIntent | null {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!normalized) return null;

  let sort: GameSort | undefined;
  if (/\b(salen|sale|saldra|saldran|proximo|proxim[oa]s|este mes|esta semana|prox lanzamiento|upcoming|por venir|por salir)\b/.test(normalized)) {
    sort = "upcoming";
  } else if (/\b(novedad|novedades|recien salid|recientes|salieron|sali[oó]|nuevo|nuevos)\b/.test(normalized)) {
    sort = "recent";
  } else if (/\b(mejor|mejores|top|critica|criticos|highest|valorados|puntuad[oa]s|score)\b/.test(normalized)) {
    sort = "score";
  } else if (/\b(popular|populares|trending|jugados)\b/.test(normalized)) {
    sort = "popular";
  } else if (/\b(rese[nñ]ad|reseñas|reviews)\b/.test(normalized)) {
    sort = "reviewed";
  }

  let platform: string | undefined;
  for (const { match, value } of PLATFORM_KEYWORDS) {
    if (match.test(text)) {
      platform = value;
      break;
    }
  }

  let genre: string | undefined;
  for (const { match, value } of GENRE_KEYWORDS) {
    if (match.test(text)) {
      genre = value;
      break;
    }
  }

  let limit = 8;
  const numMatch = text.match(/\btop\s*(\d{1,2})\b|\b(\d{1,2})\s*mejores?\b|\b(\d{1,2})\s*juegos\b/i);
  if (numMatch) {
    const parsed = Number(numMatch[1] ?? numMatch[2] ?? numMatch[3]);
    if (Number.isFinite(parsed) && parsed > 0) limit = Math.min(Math.max(parsed, 3), 15);
  }

  let year: number | undefined;
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) year = Number(yearMatch[0]);

  // If we found nothing strong, only rescue when the message clearly asks about games.
  const hasGameKeyword = /\b(juego|juegos|game|games|titulo|titulos|saga|lanzamiento)\b/.test(normalized);
  if (!sort && !platform && !genre && !hasGameKeyword) return null;

  // Default to "score" if intent is "best/top" implied by context but not detected.
  if (!sort) sort = "popular";

  const args: Record<string, unknown> = { sort, limit };
  if (platform) args.platform = platform;
  if (genre) args.genre = genre;
  if (year) args.year = year;

  return { tool: "search_games", args };
}

async function attemptIntentRescue(
  conversation: ChatMessage[],
  send: (event: { type: string; [k: string]: unknown }) => void
): Promise<boolean> {
  const lastUser = [...conversation].reverse().find((m) => m.role === "user");
  if (!lastUser?.content) return false;

  const intent = inferIntentFromText(lastUser.content);
  if (!intent) return false;

  log.info("intent rescue", { tool: intent.tool, args: intent.args });
  send({ type: "tool", name: intent.tool });

  const result = await searchGamesTool(intent.args);
  const syntheticId = `rescue-${Date.now()}`;

  conversation.push({
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: syntheticId,
        type: "function",
        function: { name: intent.tool, arguments: JSON.stringify(intent.args) }
      }
    ]
  });
  conversation.push({
    role: "tool",
    tool_call_id: syntheticId,
    name: intent.tool,
    content: JSON.stringify(result)
  });
  return true;
}

function parseMessages(payload: unknown): ChatMessage[] | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(raw)) return null;

  const cleaned: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const trimmed = content.trim().slice(0, MAX_CHARS_PER_MESSAGE);
    if (!trimmed) continue;
    cleaned.push({ role, content: trimmed });
  }
  return cleaned;
}

function parseSort(value: unknown): GameSort | undefined {
  const valid: GameSort[] = ["popular", "score", "recent", "upcoming", "reviewed"];
  if (typeof value !== "string") return undefined;
  return valid.find((sort) => sort === value);
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function strOrUndefined(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}

function takeRateToken(key: string) {
  const now = Date.now();
  if (rateBuckets.size > RATE_BUCKET_SWEEP_THRESHOLD) {
    for (const [k, b] of rateBuckets) {
      if (b.resetAt <= now) rateBuckets.delete(k);
    }
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true as const };
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { ok: false as const, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count++;
  return { ok: true as const };
}

type UserContext = {
  displayName?: string;
  favoritePlatforms: string[];
  favoriteGenres: string[];
  recentTitles: string[];
};

async function buildUserContext(request: Request): Promise<UserContext | null> {
  try {
    const userId = await getOptionalUserIdFromRequest(request);
    if (!userId) return null;

    const client = createServiceDatabaseClient();
    const [{ data: profile }, { data: library }] = await Promise.all([
      client
        .from("profiles")
        .select("display_name,favorite_platforms,favorite_genres")
        .eq("id", userId)
        .maybeSingle(),
      client
        .from("user_games")
        .select("status,updated_at,games(title)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(8)
    ]);

    const recentTitles = ((library ?? []) as Array<{ games?: { title?: string } | null }>)
      .map((row) => row?.games?.title)
      .filter((title): title is string => Boolean(title));

    return {
      displayName: profile?.display_name ?? undefined,
      favoritePlatforms: (profile?.favorite_platforms ?? []) as string[],
      favoriteGenres: (profile?.favorite_genres ?? []) as string[],
      recentTitles
    };
  } catch (error) {
    log.debug("user context unavailable", { error });
    return null;
  }
}

function buildSystemPrompt(user: UserContext | null) {
  const today = new Date().toISOString().slice(0, 10);
  const parts = [
    "Eres GameIndex Assistant, un experto en videojuegos integrado en la web GameIndex.",
    "Responde siempre en español (salvo que el usuario escriba claramente en otro idioma).",
    "",
    "Tienes herramientas para consultar el catálogo real (basado en IGDB/RAWG/Neon). ÚSALAS siempre que la pregunta dependa de datos concretos o actuales:",
    "- 'qué juegos salen / próximos lanzamientos / esta semana / este mes' → search_games con sort='upcoming'.",
    "- 'novedades / juegos recién salidos' → search_games con sort='recent'.",
    "- 'mejores juegos de X / top de X' → search_games con sort='score' (+ género/plataforma).",
    "- 'buscar / información sobre <título>' → search_games con query=<título>; si necesitas detalles, get_game_details(slug).",
    "- 'recomiéndame algo como <título>' → primero search_games para resolver el slug, luego get_similar_games(slug).",
    "",
    "Si una pregunta NO requiere catálogo (lore, historia, mecánicas, opiniones generales), responde directamente sin llamar a herramientas.",
    "",
    "Reglas de formato:",
    "- Listas de juegos: usa viñetas markdown. Formato sugerido: \"- **Título** — año, plataforma. Breve nota.\".",
    "- Cuando una herramienta haya devuelto un `slug` para un juego que vas a citar, añade `(slug: <slug-exacto>)` justo después de **Título** para que la web pueda enlazar a la ficha. Si NO conoces el slug, simplemente omite el marcador (no lo inventes).",
    "- Usa **negritas** para los nombres de juegos.",
    "- Sé conciso y directo; sin preámbulos largos.",
    "- Nunca inventes fechas, puntuaciones o títulos. Si una herramienta no devuelve resultados, dilo claramente.",
    "- Responde SIEMPRE con texto al final del flujo. Nunca termines sin contenido para el usuario.",
    "",
    `Fecha actual: ${today}.`
  ];

  if (user) {
    parts.push("", "Contexto del usuario autenticado (úsalo solo si es relevante a la pregunta):");
    if (user.displayName) parts.push(`- Nombre: ${user.displayName}.`);
    if (user.favoritePlatforms.length) parts.push(`- Plataformas favoritas: ${user.favoritePlatforms.join(", ")}.`);
    if (user.favoriteGenres.length) parts.push(`- Géneros favoritos: ${user.favoriteGenres.join(", ")}.`);
    if (user.recentTitles.length) parts.push(`- Juegos recientes en su biblioteca: ${user.recentTitles.slice(0, 6).join(", ")}.`);
  }

  return parts.join("\n");
}

import { jsonError } from "@/lib/api";
import { createLogger } from "@/lib/logger";
import { getExploreGames } from "@/services/games";
import type { Game, GameSort } from "@/data/games";

export const dynamic = "force-dynamic";

const log = createLogger("api/chat");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 4000;
const MAX_TOOL_ROUNDS = 3;

const SYSTEM_PROMPT = `Eres GameIndex Assistant, un experto en videojuegos integrado en la web GameIndex.
Responde siempre en español (salvo que el usuario escriba claramente en otro idioma).

Tienes acceso a herramientas para consultar el catálogo real de GameIndex (basado en IGDB/RAWG). ÚSALAS siempre que la pregunta dependa de datos concretos o actuales:
- "qué juegos salen / van a salir / próximos lanzamientos / esta semana / este mes" → usa search_games con sort="upcoming".
- "novedades / juegos recién salidos / qué ha salido" → usa search_games con sort="recent".
- "mejores juegos de X / top de X / juegos mejor valorados" → usa search_games con sort="score" y filtros adecuados.
- "buscar / información sobre <título>" → usa search_games con query=<título>.
- Filtrado por plataforma, género o año → pasa los parámetros correspondientes.

Si una pregunta NO requiere datos del catálogo (lore, historia, mecánicas, opiniones generales), responde directamente sin llamar a herramientas.

Reglas de formato:
- Para listas de juegos, usa viñetas markdown ("- **Título** (año, plataforma) — breve nota").
- Usa **negritas** para nombres de juegos cuando los menciones.
- Sé conciso y directo. Sin preámbulos largos.
- Nunca inventes fechas, puntuaciones o títulos. Si la herramienta no devuelve resultados, dilo.

La fecha actual es ${new Date().toISOString().slice(0, 10)}.`;

type ChatRole = "user" | "assistant" | "tool";
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
        "Busca en el catálogo de GameIndex. Devuelve una lista de juegos con título, año, plataformas, géneros, fecha de lanzamiento, puntuación y desarrolladora.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Texto libre para buscar (título del juego, etc.). Opcional."
          },
          sort: {
            type: "string",
            enum: ["popular", "score", "recent", "upcoming", "reviewed"],
            description:
              "Ordenación. Usa 'upcoming' para próximos lanzamientos, 'recent' para novedades, 'score' para mejor valorados, 'popular' para más populares, 'reviewed' para más reseñados."
          },
          platform: {
            type: "string",
            description: "Plataforma (ej. 'PC', 'PlayStation 5', 'Nintendo Switch'). Opcional."
          },
          genre: {
            type: "string",
            description: "Género (ej. 'RPG', 'Shooter', 'Indie'). Opcional."
          },
          year: {
            type: "integer",
            description: "Año de lanzamiento. Opcional."
          },
          limit: {
            type: "integer",
            description: "Número máximo de resultados (1-15). Por defecto 8.",
            minimum: 1,
            maximum: 15
          }
        }
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Cuerpo de la petición inválido.", 400);
  }

  const incoming = parseMessages(payload);
  if (!incoming) return jsonError("Mensajes inválidos.", 400);
  if (incoming.length === 0) return jsonError("No hay mensajes que procesar.", 400);

  const conversation: ChatMessage[] = [
    { role: "system" as unknown as ChatRole, content: SYSTEM_PROMPT },
    ...incoming
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await callGroq(apiKey, conversation);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        log.warn("groq error", { status: response.status, body: text.slice(0, 500) });
        return jsonError("El asistente no está disponible ahora mismo.", 502);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            role?: string;
            content?: string | null;
            tool_calls?: ChatMessage["tool_calls"];
          };
          finish_reason?: string;
        }>;
      };
      const choice = data.choices?.[0];
      const message = choice?.message;
      if (!message) {
        return jsonError("Respuesta vacía del asistente.", 502);
      }

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const reply = (message.content ?? "").trim();
        if (!reply) return jsonError("Respuesta vacía del asistente.", 502);
        return Response.json({ reply });
      }

      conversation.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: toolCalls
      });

      for (const call of toolCalls) {
        const result = await runTool(call.function.name, call.function.arguments);
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result)
        });
      }
    }

    log.warn("tool loop exhausted");
    return jsonError("El asistente no pudo completar la consulta.", 502);
  } catch (error) {
    log.error("chat request failed", { error });
    return jsonError("Error inesperado al consultar el asistente.", 500);
  }
}

async function callGroq(apiKey: string, messages: ChatMessage[]) {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.5,
      max_tokens: 900,
      messages,
      tools: TOOLS,
      tool_choice: "auto"
    })
  });
}

async function runTool(name: string, rawArgs: string) {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { error: "Argumentos inválidos." };
  }

  if (name === "search_games") {
    return searchGamesTool(args);
  }
  return { error: `Herramienta desconocida: ${name}` };
}

async function searchGamesTool(args: Record<string, unknown>) {
  const limit = clampInt(args.limit, 8, 1, 15);
  const sort = parseSort(args.sort);
  const query = typeof args.query === "string" ? args.query.trim() || undefined : undefined;
  const platform = typeof args.platform === "string" ? args.platform.trim() || undefined : undefined;
  const genre = typeof args.genre === "string" ? args.genre.trim() || undefined : undefined;
  const year = clampInt(args.year, 0, 1970, 2100) || undefined;

  try {
    const result = await getExploreGames({
      query,
      sort,
      platform,
      genre,
      year,
      pageSize: limit
    });

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
    summary: truncate(game.summary, 240)
  };
}

function truncate(value: string, max: number) {
  if (!value) return "";
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
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

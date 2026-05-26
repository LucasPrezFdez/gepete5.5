import { createLogger } from "@/lib/logger";
import { createSqlClient } from "@/services/database";

const log = createLogger("services/llm-metrics");

export type LlmScope = "chat" | "recommendations";
export type LlmOutcome = "llm" | "cache_hit" | "fallback" | "error";

const TIMESERIES_DAYS = 14;

export type LogLlmCallInput = {
  scope: LlmScope;
  outcome: LlmOutcome;
  userId?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs?: number | null;
  httpStatus?: number | null;
  errorCode?: string | null;
};

export async function logLlmCall(input: LogLlmCallInput): Promise<void> {
  try {
    const sql = createSqlClient();
    await sql.query(
      `insert into llm_usage_log
         (scope, outcome, user_id, model, tokens_in, tokens_out, latency_ms, http_status, error_code)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.scope,
        input.outcome,
        input.userId ?? null,
        input.model ?? null,
        input.tokensIn ?? null,
        input.tokensOut ?? null,
        input.latencyMs ?? null,
        input.httpStatus ?? null,
        input.errorCode ?? null
      ]
    );
  } catch (error) {
    log.warn("failed to write llm usage log", {
      error: error instanceof Error ? error.message : String(error),
      scope: input.scope,
      outcome: input.outcome
    });
  }
}

export type ScopeMetrics = {
  scope: LlmScope;
  totalCalls: number;
  llmCalls: number;
  cacheHits: number;
  fallbackCalls: number;
  errorCalls: number;
  cacheHitRate: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  avgLatencyMs: number | null;
};

export type LlmMetrics = {
  windowDays: number;
  scopes: ScopeMetrics[];
  callsPerDay: Array<{ date: string; llm: number; cache: number }>;
  recent: Array<{
    scope: LlmScope;
    outcome: LlmOutcome;
    model: string | null;
    tokensIn: number | null;
    tokensOut: number | null;
    latencyMs: number | null;
    httpStatus: number | null;
    errorCode: string | null;
    createdAt: string;
  }>;
};

export async function loadLlmMetrics(): Promise<LlmMetrics> {
  const sql = createSqlClient();

  const [scopeRows, seriesRows, recentRows] = await Promise.all([
    sql.query(
      `select scope, outcome,
              count(*)::int as count,
              coalesce(sum(tokens_in), 0)::bigint as tokens_in,
              coalesce(sum(tokens_out), 0)::bigint as tokens_out,
              avg(latency_ms)::int as avg_latency
       from llm_usage_log
       where created_at >= now() - interval '${TIMESERIES_DAYS} days'
       group by scope, outcome`
    ),
    sql.query(
      `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
              outcome,
              count(*)::int as count
       from llm_usage_log
       where created_at >= now() - interval '${TIMESERIES_DAYS} days'
       group by 1, 2
       order by 1 asc`
    ),
    sql.query(
      `select scope, outcome, model, tokens_in, tokens_out, latency_ms, http_status, error_code, created_at
       from llm_usage_log
       order by created_at desc
       limit 20`
    )
  ]);

  const scopes = aggregateScopes(scopeRows as ScopeRawRow[]);
  const callsPerDay = fillSeries(seriesRows as SeriesRawRow[], TIMESERIES_DAYS);
  const recent = (recentRows as RecentRawRow[]).map((row) => ({
    scope: row.scope,
    outcome: row.outcome,
    model: row.model,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    latencyMs: row.latency_ms,
    httpStatus: row.http_status,
    errorCode: row.error_code,
    createdAt: row.created_at
  }));

  return {
    windowDays: TIMESERIES_DAYS,
    scopes,
    callsPerDay,
    recent
  };
}

type ScopeRawRow = {
  scope: LlmScope;
  outcome: LlmOutcome;
  count: number;
  tokens_in: number | string;
  tokens_out: number | string;
  avg_latency: number | null;
};

type SeriesRawRow = {
  date: string;
  outcome: LlmOutcome;
  count: number;
};

type RecentRawRow = {
  scope: LlmScope;
  outcome: LlmOutcome;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  http_status: number | null;
  error_code: string | null;
  created_at: string;
};

function aggregateScopes(rows: ScopeRawRow[]): ScopeMetrics[] {
  const knownScopes: LlmScope[] = ["chat", "recommendations"];
  const byScope = new Map<LlmScope, ScopeMetrics>();

  for (const scope of knownScopes) {
    byScope.set(scope, emptyScopeMetrics(scope));
  }

  for (const row of rows) {
    if (!byScope.has(row.scope)) byScope.set(row.scope, emptyScopeMetrics(row.scope));
    const entry = byScope.get(row.scope)!;
    entry.totalCalls += row.count;
    if (row.outcome === "llm") entry.llmCalls += row.count;
    if (row.outcome === "cache_hit") entry.cacheHits += row.count;
    if (row.outcome === "fallback") entry.fallbackCalls += row.count;
    if (row.outcome === "error") entry.errorCalls += row.count;
    entry.totalTokensIn += Number(row.tokens_in ?? 0);
    entry.totalTokensOut += Number(row.tokens_out ?? 0);

    if (row.outcome === "llm" && row.avg_latency !== null) {
      const weighted = (entry.avgLatencyMs ?? 0) * (entry.llmCalls - row.count) + row.avg_latency * row.count;
      entry.avgLatencyMs = entry.llmCalls > 0 ? Math.round(weighted / entry.llmCalls) : null;
    }
  }

  for (const entry of byScope.values()) {
    entry.totalTokens = entry.totalTokensIn + entry.totalTokensOut;
    entry.cacheHitRate =
      entry.totalCalls > 0 ? Math.round((entry.cacheHits / entry.totalCalls) * 100) : 0;
  }

  return Array.from(byScope.values());
}

function emptyScopeMetrics(scope: LlmScope): ScopeMetrics {
  return {
    scope,
    totalCalls: 0,
    llmCalls: 0,
    cacheHits: 0,
    fallbackCalls: 0,
    errorCalls: 0,
    cacheHitRate: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalTokens: 0,
    avgLatencyMs: null
  };
}

function fillSeries(rows: SeriesRawRow[], days: number) {
  const byDate = new Map<string, { llm: number; cache: number }>();
  for (const row of rows) {
    const bucket = byDate.get(row.date) ?? { llm: 0, cache: 0 };
    if (row.outcome === "llm" || row.outcome === "fallback") bucket.llm += row.count;
    if (row.outcome === "cache_hit") bucket.cache += row.count;
    byDate.set(row.date, bucket);
  }

  const points: Array<{ date: string; llm: number; cache: number }> = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? { llm: 0, cache: 0 };
    points.push({ date: key, llm: bucket.llm, cache: bucket.cache });
  }
  return points;
}

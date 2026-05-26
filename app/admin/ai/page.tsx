import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { ChartCard, HorizontalBarChart, SparkLine } from "@/components/admin/AdminCharts";
import { Table, TableEmptyState, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { loadLlmMetrics, type LlmOutcome, type LlmScope, type ScopeMetrics } from "@/services/llm-metrics";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SCOPE_LABEL: Record<LlmScope, string> = {
  chat: "Chat asistente",
  recommendations: "Recomendaciones"
};

const OUTCOME_LABEL: Record<LlmOutcome, string> = {
  llm: "LLM",
  cache_hit: "Cache hit",
  fallback: "Fallback determinista",
  error: "Error"
};

const OUTCOME_TONE: Record<LlmOutcome, string> = {
  llm: "bg-electric/15 text-electric",
  cache_hit: "bg-[#A3E635]/15 text-[#A3E635]",
  fallback: "bg-amber-500/15 text-amber-300",
  error: "bg-danger/15 text-danger"
};

export default async function AdminAiPage() {
  const metrics = await loadLlmMetrics();
  const totals = aggregateTotals(metrics.scopes);

  return (
    <>
      <AdminPageHeader
        title="Telemetría de IA"
        description={`Uso del proveedor LLM (Groq) en los últimos ${metrics.windowDays} días. Tokens, latencia y eficacia del caché.`}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "IA" }]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Llamadas totales"
          value={totals.totalCalls}
          hint={`${totals.llmCalls.toLocaleString("es-ES")} a Groq · ${totals.cacheHits.toLocaleString("es-ES")} cache hits`}
        />
        <StatCard
          label="Tokens consumidos"
          value={totals.totalTokens}
          hint={`${totals.totalTokensIn.toLocaleString("es-ES")} in · ${totals.totalTokensOut.toLocaleString("es-ES")} out`}
        />
        <StatCard
          label="Tasa cache hit"
          value={`${totals.cacheHitRate}%`}
          hint="Peticiones servidas sin consultar Groq"
          tone={totals.cacheHitRate >= 30 ? "accent" : "default"}
        />
        <StatCard
          label="Latencia media"
          value={totals.avgLatencyMs !== null ? `${totals.avgLatencyMs} ms` : "—"}
          hint="Solo llamadas reales al LLM"
        />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Llamadas por día"
          hint={`Últimos ${metrics.windowDays} días`}
          total={metrics.callsPerDay.reduce((sum, point) => sum + point.llm + point.cache, 0).toLocaleString("es-ES")}
        >
          <SparkLine
            data={metrics.callsPerDay.map((point) => ({ date: point.date, value: point.llm }))}
            accent="#60A5FA"
          />
          <p className="mt-2 text-[11px] text-muted">Línea: llamadas reales al LLM. Cache hits no consumen tokens.</p>
        </ChartCard>

        <ChartCard
          title="Distribución por scope"
          hint="Tokens consumidos por funcionalidad"
        >
          <HorizontalBarChart
            data={metrics.scopes.map((scope) => ({
              label: scope.scope,
              value: scope.totalTokens
            }))}
            accent="#8B5CF6"
            labelMap={SCOPE_LABEL}
          />
        </ChartCard>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {metrics.scopes.map((scope) => (
          <ScopeCard key={scope.scope} scope={scope} />
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Últimas 20 llamadas</h2>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Scope</TH>
                <TH>Resultado</TH>
                <TH className="hidden md:table-cell">Modelo</TH>
                <TH className="text-right">Tokens in</TH>
                <TH className="text-right">Tokens out</TH>
                <TH className="text-right">Latencia</TH>
                <TH className="text-right">Cuándo</TH>
              </tr>
            </THead>
            <TBody>
              {metrics.recent.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <TableEmptyState
                      title="Sin registros de IA"
                      description="No se han registrado llamadas al LLM todavía. Usa el chat o las recomendaciones para generar datos."
                    />
                  </td>
                </tr>
              ) : (
                metrics.recent.map((row, index) => (
                  <TR key={`${row.createdAt}-${index}`}>
                    <TD>
                      <span className="font-semibold text-foreground">{SCOPE_LABEL[row.scope] ?? row.scope}</span>
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          OUTCOME_TONE[row.outcome] ?? "bg-white/[0.06] text-muted"
                        )}
                      >
                        {OUTCOME_LABEL[row.outcome] ?? row.outcome}
                      </span>
                      {row.errorCode ? (
                        <span className="ml-2 font-mono text-[10.5px] text-danger/80">{row.errorCode}</span>
                      ) : null}
                    </TD>
                    <TD className="hidden md:table-cell font-mono text-[11px] text-muted">{row.model ?? "—"}</TD>
                    <TD className="text-right font-mono text-[11.5px] tabular-nums">
                      {row.tokensIn !== null ? row.tokensIn.toLocaleString("es-ES") : "—"}
                    </TD>
                    <TD className="text-right font-mono text-[11.5px] tabular-nums">
                      {row.tokensOut !== null ? row.tokensOut.toLocaleString("es-ES") : "—"}
                    </TD>
                    <TD className="text-right font-mono text-[11.5px] tabular-nums">
                      {row.latencyMs !== null ? `${row.latencyMs}ms` : "—"}
                    </TD>
                    <TD className="text-right font-mono text-[11px] text-muted" title={row.createdAt}>
                      {formatRelative(row.createdAt)}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>
    </>
  );
}

function ScopeCard({ scope }: { scope: ScopeMetrics }) {
  const cachePercent = scope.cacheHitRate;
  const errorPercent = scope.totalCalls > 0 ? Math.round((scope.errorCalls / scope.totalCalls) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{SCOPE_LABEL[scope.scope] ?? scope.scope}</h3>
          <p className="mt-0.5 text-[11px] text-muted">{scope.totalCalls.toLocaleString("es-ES")} peticiones</p>
        </div>
        <span className="font-mono text-2xl font-bold tabular-nums">{scope.totalTokens.toLocaleString("es-ES")}</span>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-[12px]">
        <Metric label="Llamadas LLM" value={scope.llmCalls.toLocaleString("es-ES")} />
        <Metric label="Cache hits" value={`${scope.cacheHits.toLocaleString("es-ES")} (${cachePercent}%)`} />
        <Metric label="Fallback" value={scope.fallbackCalls.toLocaleString("es-ES")} />
        <Metric
          label="Errores"
          value={`${scope.errorCalls.toLocaleString("es-ES")} (${errorPercent}%)`}
          tone={errorPercent > 5 ? "danger" : "default"}
        />
        <Metric label="Tokens in" value={scope.totalTokensIn.toLocaleString("es-ES")} />
        <Metric label="Tokens out" value={scope.totalTokensOut.toLocaleString("es-ES")} />
        <Metric
          label="Latencia media"
          value={scope.avgLatencyMs !== null ? `${scope.avgLatencyMs} ms` : "—"}
        />
        <Metric label="Coste evitado" value={`${cachePercent}% peticiones`} />
      </dl>
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <dt className="text-[10.5px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-mono text-[13px] font-semibold tabular-nums", tone === "danger" && "text-danger")}>
        {value}
      </dd>
    </div>
  );
}

function aggregateTotals(scopes: ScopeMetrics[]) {
  const totalCalls = scopes.reduce((sum, s) => sum + s.totalCalls, 0);
  const llmCalls = scopes.reduce((sum, s) => sum + s.llmCalls, 0);
  const cacheHits = scopes.reduce((sum, s) => sum + s.cacheHits, 0);
  const totalTokensIn = scopes.reduce((sum, s) => sum + s.totalTokensIn, 0);
  const totalTokensOut = scopes.reduce((sum, s) => sum + s.totalTokensOut, 0);
  const totalTokens = totalTokensIn + totalTokensOut;
  const cacheHitRate = totalCalls > 0 ? Math.round((cacheHits / totalCalls) * 100) : 0;
  const llmWithLatency = scopes.filter((s) => s.avgLatencyMs !== null && s.llmCalls > 0);
  const avgLatencyMs = llmWithLatency.length
    ? Math.round(
        llmWithLatency.reduce((sum, s) => sum + (s.avgLatencyMs ?? 0) * s.llmCalls, 0) /
          llmWithLatency.reduce((sum, s) => sum + s.llmCalls, 0)
      )
    : null;
  return { totalCalls, llmCalls, cacheHits, totalTokensIn, totalTokensOut, totalTokens, cacheHitRate, avgLatencyMs };
}

function formatRelative(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return iso;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

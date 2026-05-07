import { formatCompactNumber } from "@/lib/utils";

type ScoreDistributionProps = {
  averageScore?: number | null;
  ratingsCount?: number | null;
  criticScore?: number | null;
  source?: string;
};

export function ScoreDistribution({
  averageScore,
  ratingsCount,
  criticScore,
  source = "IGDB"
}: ScoreDistributionProps) {
  const hasAverageScore = isFiniteNumber(averageScore) && averageScore > 0;
  const hasRatingsCount = isFiniteNumber(ratingsCount) && ratingsCount > 0;
  const hasCriticScore = isFiniteNumber(criticScore) && criticScore > 0;
  const hasData = hasAverageScore || hasRatingsCount || hasCriticScore;

  return (
    <div className="surface-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="font-semibold">Puntuaciones externas</h3>
        <span className="text-sm text-muted">{source}</span>
      </div>

      {!hasData ? (
        <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-muted">
          No hay puntuaciones de {source} disponibles para este juego.
        </p>
      ) : (
        <dl className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <dt className="text-sm text-muted">Nota media de usuarios {source}</dt>
            <dd className="mt-2 flex items-baseline gap-2" aria-label={getAverageAriaLabel(averageScore, source)}>
              <span className="text-4xl font-black text-foreground">
                {hasAverageScore ? formatScoreOutOfTen(averageScore) : "—"}
              </span>
              <span className="text-sm font-semibold text-muted">/10</span>
            </dd>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <dt className="text-sm text-muted">Valoraciones registradas en {source}</dt>
            <dd className="font-semibold text-foreground">
              {hasRatingsCount ? formatCompactNumber(ratingsCount) : "Sin recuento"}
            </dd>
          </div>

          {hasCriticScore && (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <dt className="text-sm text-muted">Crítica agregada</dt>
              <dd className="font-semibold text-foreground" aria-label={`Crítica agregada ${Math.round(criticScore)} sobre 100`}>
                {Math.round(criticScore)}/100
              </dd>
            </div>
          )}

          <p className="text-xs leading-5 text-muted">
            Fuente: {source}. {source} no publica una distribución por nota 1–10 para este dato.
          </p>
        </dl>
      )}
    </div>
  );
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatScoreOutOfTen(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "—";
  return value.toLocaleString("es", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function getAverageAriaLabel(value: number | null | undefined, source: string) {
  return isFiniteNumber(value) && value > 0
    ? `Nota media de usuarios ${source}: ${formatScoreOutOfTen(value)} sobre 10`
    : `Nota media de usuarios ${source} no disponible`;
}

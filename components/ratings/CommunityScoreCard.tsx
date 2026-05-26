import { formatCompactNumber } from "@/lib/utils";

type Props = {
  averageScore?: number | null;
  ratingsCount?: number | null;
  reviewsCount?: number | null;
};

export function CommunityScoreCard({ averageScore, ratingsCount, reviewsCount }: Props) {
  const hasAverage = typeof averageScore === "number" && Number.isFinite(averageScore) && averageScore > 0;
  const ratings = Math.max(0, Number(ratingsCount ?? 0) || 0);
  const reviews = Math.max(0, Number(reviewsCount ?? 0) || 0);
  const scoreText = hasAverage
    ? averageScore!.toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "—";
  const scoreTone = !hasAverage
    ? "text-muted"
    : averageScore! >= 9
      ? "text-lime"
      : averageScore! >= 7
        ? "text-electric"
        : averageScore! >= 5
          ? "text-amber-400"
          : "text-danger";

  return (
    <section className="surface-card relative overflow-hidden rounded-2xl p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-electric/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-violet/15 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-br from-electric via-violet to-lime opacity-50 blur-md" aria-hidden />
            <div className="relative grid h-24 w-24 place-items-center rounded-3xl border border-white/15 bg-background/70 shadow-glow">
              <div className="flex items-baseline gap-0.5">
                <span className={`text-4xl font-black tabular-nums ${scoreTone}`}>{scoreText}</span>
                <span className="text-xs font-semibold text-muted">/10</span>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-electric">Comunidad</p>
            </div>
            <h2 className="text-xl font-black md:text-2xl">Media de la comunidad</h2>
            <p className="mt-1 text-xs text-muted md:text-sm">
              {hasAverage
                ? `Promedio de ${formatCompactNumber(ratings)} valoraciones de usuarios de GameIndex.`
                : "Todavía nadie ha valorado este juego. Sé el primero en dejar una nota."}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 md:min-w-[260px]">
          <Stat label="Valoraciones" value={formatCompactNumber(ratings)} />
          <Stat label="Reseñas largas" value={formatCompactNumber(reviews)} />
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-black tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

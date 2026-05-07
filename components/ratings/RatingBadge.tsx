import { cn, scoreTone } from "@/lib/utils";

export function RatingBadge({
  score,
  label = "Usuarios",
  compact = false
}: {
  score?: number | null;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2",
        scoreTone(score)
      )}
      aria-label={`${label}: ${score ? score.toFixed(1) : "sin puntuación"}`}
    >
      <span className="text-base font-black">{score ? score.toFixed(1) : "?"}</span>
      {!compact && <span className="text-xs opacity-80">{label}</span>}
    </div>
  );
}


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
        "inline-flex items-center gap-1.5 rounded-xl border px-2 py-1",
        scoreTone(score),
        "bg-black/35 text-foreground/90 shadow-sm backdrop-blur-sm"
      )}
      aria-label={`${label}: ${score ? score.toFixed(1) : "sin puntuación"}`}
    >
      <span className="text-sm font-extrabold tabular-nums leading-none">
        {score ? score.toFixed(1) : "?"}
      </span>
      {!compact && (
        <span className="text-xs font-medium leading-none opacity-80">
          {label}
        </span>
      )}
    </div>
  );
}


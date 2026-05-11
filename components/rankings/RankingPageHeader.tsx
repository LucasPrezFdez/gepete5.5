import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

type Accent = "electric" | "violet" | "lime" | "danger";

type Stat = { label: string; value: string; accent?: boolean };

const ACCENT = {
  electric: {
    badge: "blue" as const,
    blob1: "bg-electric/25",
    blob2: "bg-violet/20",
    highlight: "text-electric"
  },
  violet: {
    badge: "violet" as const,
    blob1: "bg-violet/25",
    blob2: "bg-electric/15",
    highlight: "text-violet-200"
  },
  lime: {
    badge: "lime" as const,
    blob1: "bg-lime/25",
    blob2: "bg-electric/15",
    highlight: "text-lime"
  },
  danger: {
    badge: "danger" as const,
    blob1: "bg-danger/25",
    blob2: "bg-violet/15",
    highlight: "text-danger"
  }
};

export function RankingPageHeader({
  eyebrow,
  title,
  highlightWord,
  description,
  stats,
  accent = "electric",
  backHref = "/rankings",
  backLabel = "Volver a rankings"
}: {
  eyebrow: string;
  title: string;
  highlightWord?: string;
  description?: string;
  stats?: Stat[];
  accent?: Accent;
  backHref?: string;
  backLabel?: string;
}) {
  const tone = ACCENT[accent];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface/80 shadow-card backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-br from-electric/10 via-violet/5 to-transparent" />
      <div
        className={`absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl ${tone.blob1}`}
      />
      <div
        className={`absolute -right-32 -bottom-32 h-72 w-72 rounded-full blur-3xl ${tone.blob2}`}
      />
      <div className="relative space-y-5 p-7 md:p-9">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-foreground"
          >
            <span aria-hidden>←</span>
            {backLabel}
          </Link>
          <span className="hidden text-muted/40 md:inline">·</span>
          <Badge tone={tone.badge} className="uppercase tracking-[0.3em]">
            {eyebrow}
          </Badge>
        </div>
        <h1 className="text-balance text-3xl font-black leading-tight md:text-4xl">
          {renderTitle(title, highlightWord, tone.highlight)}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-7 text-muted md:text-base">
            {description}
          </p>
        )}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-5 sm:grid-cols-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p
                  className={`text-2xl font-black tabular-nums md:text-3xl ${
                    s.accent ? "text-lime" : "text-foreground"
                  }`}
                >
                  {s.value}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderTitle(title: string, highlight: string | undefined, toneClass: string) {
  if (!highlight) return title;
  const parts = title.split(highlight);
  return parts.flatMap((part, i) =>
    i < parts.length - 1
      ? [
          <span key={`p${i}`}>{part}</span>,
          <span key={`h${i}`} className={toneClass}>
            {highlight}
          </span>
        ]
      : [<span key={`p${i}`}>{part}</span>]
  );
}

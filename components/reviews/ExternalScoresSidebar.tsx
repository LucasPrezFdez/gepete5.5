"use client";

import { useState } from "react";
import { ScoreDistribution } from "@/components/ratings/ScoreDistribution";

type Props = {
  averageScore?: number | null;
  ratingsCount?: number | null;
  criticScore?: number | null;
  source?: string;
};

export function ExternalScoresSidebar(props: Props) {
  const [open, setOpen] = useState(true);

  return (
    <aside className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-semibold transition hover:border-white/20 hover:bg-white/[0.06]"
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-electric" aria-hidden />
          <span>Puntuaciones externas</span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            {props.source ?? "IGDB"}
          </span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : "rotate-0"}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <ScoreDistribution {...props} />}
    </aside>
  );
}

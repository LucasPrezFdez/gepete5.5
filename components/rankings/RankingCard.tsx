"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, KeyboardEvent, MouseEvent } from "react";

type Accent = "electric" | "violet" | "lime" | "danger";

const ACCENT_MAP: Record<
  Accent,
  { eyebrow: string; hover: string; blob: string; titleHover: string }
> = {
  electric: {
    eyebrow: "text-electric",
    hover: "hover:border-electric/45 hover:shadow-glow",
    blob: "bg-electric/15",
    titleHover: "group-hover:text-electric"
  },
  violet: {
    eyebrow: "text-violet-300",
    hover: "hover:border-violet/45",
    blob: "bg-violet/20",
    titleHover: "group-hover:text-violet-200"
  },
  lime: {
    eyebrow: "text-lime",
    hover: "hover:border-lime/45",
    blob: "bg-lime/15",
    titleHover: "group-hover:text-lime"
  },
  danger: {
    eyebrow: "text-danger",
    hover: "hover:border-danger/45",
    blob: "bg-danger/15",
    titleHover: "group-hover:text-danger"
  }
};

export function RankingCard({
  href,
  eyebrow,
  title,
  description,
  accent,
  className = "",
  children
}: {
  href: string;
  eyebrow: string;
  title: string;
  description?: string;
  accent: Accent;
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const tone = ACCENT_MAP[accent];

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    router.push(href);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative isolate flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/80 shadow-card backdrop-blur transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background ${tone.hover} ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-90 ${tone.blob} opacity-60`}
      />
      <div className="relative flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={`text-[11px] font-bold uppercase tracking-[0.25em] ${tone.eyebrow}`}
            >
              {eyebrow}
            </p>
            <h3
              className={`mt-2 text-xl font-black leading-tight transition md:text-2xl ${tone.titleHover}`}
            >
              {title}
            </h3>
          </div>
          <span
            aria-hidden
            className="mt-1 text-muted transition-transform group-hover:translate-x-1 group-hover:text-foreground"
          >
            →
          </span>
        </div>
        {description && (
          <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        )}
        {children && <div className="mt-auto pt-5">{children}</div>}
      </div>
    </div>
  );
}

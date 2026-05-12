"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Game, UserGameStatus } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { createBrowserAuthClient } from "@/services/auth-browser";
import { cn } from "@/lib/utils";

type LibraryItem = { status: UserGameStatus; createdAt: string; game: Game | null };

const STATUS_META: Record<UserGameStatus, {
  label: string;
  short: string;
  tone: string;
  pill: string;
  icon: React.ReactNode;
}> = {
  want_to_play: {
    label: "Pendientes",
    short: "Pendiente",
    tone: "from-electric/30 to-electric/5 border-electric/40 text-electric",
    pill: "border-electric/40 bg-electric/15 text-blue-200",
    icon: <BookmarkIcon />
  },
  playing: {
    label: "Jugando",
    short: "Jugando",
    tone: "from-violet/30 to-violet/5 border-violet/40 text-violet-200",
    pill: "border-violet/40 bg-violet/15 text-violet-200",
    icon: <PlayIcon />
  },
  completed: {
    label: "Completados",
    short: "Completado",
    tone: "from-lime/30 to-lime/5 border-lime/40 text-lime",
    pill: "border-lime/40 bg-lime/15 text-lime",
    icon: <TrophyIcon />
  },
  dropped: {
    label: "Abandonados",
    short: "Abandonado",
    tone: "from-danger/30 to-danger/5 border-danger/40 text-danger",
    pill: "border-danger/40 bg-danger/15 text-danger",
    icon: <BanIcon />
  },
  paused: {
    label: "Pausados",
    short: "Pausado",
    tone: "from-amber-400/25 to-amber-400/5 border-amber-400/40 text-amber-300",
    pill: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    icon: <PauseIcon />
  },
  favorite: {
    label: "Favoritos",
    short: "Favorito",
    tone: "from-pink-500/30 to-pink-500/5 border-pink-400/40 text-pink-200",
    pill: "border-pink-400/40 bg-pink-500/15 text-pink-200",
    icon: <HeartIcon />
  }
};

const STATUS_ORDER: UserGameStatus[] = ["want_to_play", "playing", "completed", "paused", "dropped", "favorite"];

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [activeStatus, setActiveStatus] = useState<UserGameStatus | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const authClient = createBrowserAuthClient();
        const { data } = await authClient.auth.getSession();
        if (!data.session?.access_token) {
          setError("Inicia sesión para ver tu biblioteca.");
          return;
        }
        const response = await fetch("/api/me/library", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store"
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "No se pudo cargar la biblioteca.");
        setItems(payload.statuses ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const counts = useMemo(() => {
    const map = new Map<UserGameStatus, number>();
    for (const item of items) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [items]);

  const uniqueGames = useMemo(() => {
    const seen = new Set<string>();
    const acc: LibraryItem[] = [];
    for (const item of items) {
      if (!item.game) continue;
      if (seen.has(item.game.slug)) continue;
      seen.add(item.game.slug);
      acc.push(item);
    }
    return acc;
  }, [items]);

  const filtered = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const base = activeStatus === "all" ? items : items.filter((item) => item.status === activeStatus);
    if (!cleanQuery) return base;
    return base.filter((item) => item.game?.title.toLowerCase().includes(cleanQuery));
  }, [activeStatus, items, query]);

  const heroGame = useMemo(() => {
    const favorite = items.find((item) => item.status === "favorite" && item.game?.heroUrl);
    if (favorite?.game) return favorite.game;
    const playing = items.find((item) => item.status === "playing" && item.game?.heroUrl);
    if (playing?.game) return playing.game;
    const anyHero = items.find((item) => item.game?.heroUrl || item.game?.coverUrl);
    return anyHero?.game ?? null;
  }, [items]);

  const avgScore = useMemo(() => {
    const scored = uniqueGames.filter((item) => item.game && item.game.userScore > 0);
    if (!scored.length) return 0;
    return scored.reduce((acc, item) => acc + (item.game?.userScore ?? 0), 0) / scored.length;
  }, [uniqueGames]);

  return (
    <section className="container-page py-10">
      <LibraryHero
        totalGames={uniqueGames.length}
        totalEntries={items.length}
        completed={counts.get("completed") ?? 0}
        playing={counts.get("playing") ?? 0}
        favorites={counts.get("favorite") ?? 0}
        avgScore={avgScore}
        heroGame={heroGame}
      />

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip
            label="Todo"
            count={items.length}
            active={activeStatus === "all"}
            onClick={() => setActiveStatus("all")}
            icon={<StackIcon />}
            activeClass="from-white/20 to-white/5 border-white/40 text-foreground"
          />
          {STATUS_ORDER.map((status) => (
            <StatusChip
              key={status}
              label={STATUS_META[status].label}
              count={counts.get(status) ?? 0}
              active={activeStatus === status}
              onClick={() => setActiveStatus(status)}
              icon={STATUS_META[status].icon}
              activeClass={STATUS_META[status].tone}
            />
          ))}
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-surface/85 p-3 shadow-card backdrop-blur md:grid-cols-[1fr_auto] md:items-center">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-muted">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en tu biblioteca..."
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-11 pr-4 text-sm text-foreground placeholder:text-muted transition focus:border-electric/60 focus:bg-white/[0.08] focus:outline-none"
            />
          </div>
          <div className="flex h-11 items-center gap-2 md:justify-end">
            <p className="hidden text-xs font-medium text-muted sm:block">
              <span className="font-bold text-foreground">{filtered.length}</span> resultado{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="ml-auto flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Vista de cuadrícula"
                title="Vista de cuadrícula"
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition",
                  view === "grid" ? "bg-electric text-white shadow-[0_0_18px_rgba(59,130,246,0.5)]" : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                )}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="Vista de lista"
                title="Vista de lista"
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition",
                  view === "list" ? "bg-electric text-white shadow-[0_0_18px_rgba(59,130,246,0.5)]" : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                )}
              >
                <ListIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && <LibrarySkeleton view={view} />}
      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyLibrary activeStatus={activeStatus} hasQuery={Boolean(query.trim())} />
      )}

      {!loading && !error && filtered.length > 0 && (
        view === "grid"
          ? <GameGrid items={filtered} />
          : <GameList items={filtered} />
      )}
    </section>
  );
}

function LibraryHero({
  totalGames,
  totalEntries,
  completed,
  playing,
  favorites,
  avgScore,
  heroGame
}: {
  totalGames: number;
  totalEntries: number;
  completed: number;
  playing: number;
  favorites: number;
  avgScore: number;
  heroGame: Game | null;
}) {
  const heroImage = heroGame?.heroUrl || heroGame?.coverUrl || null;

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 shadow-card">
      <div className="relative min-h-[280px]">
        {heroImage ? (
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-electric/40 via-violet/30 to-lime/20" />
        )}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,10,18,0.55) 0%, rgba(8,10,18,0.7) 45%, rgba(8,10,18,0.95) 100%), linear-gradient(90deg, rgba(8,10,18,0.9) 0%, rgba(8,10,18,0.35) 55%, rgba(8,10,18,0.15) 100%)"
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at 12% 25%, rgba(59,130,246,0.28), transparent 50%), radial-gradient(circle at 85% 85%, rgba(139,92,246,0.22), transparent 55%), radial-gradient(circle at 65% 15%, rgba(163,230,53,0.12), transparent 45%)"
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "44px 44px"
          }}
        />

        <div className="relative flex flex-col gap-6 p-6 sm:p-10">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-px w-6 rounded-full bg-electric" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-electric">Biblioteca personal</p>
            </div>
            <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-5xl lg:text-6xl">
              Mi biblioteca
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              Organiza pendientes, juegos en curso, completados y favoritos desde cada ficha de juego.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <StatCard label="Juegos" value={totalGames} accent="text-foreground" hint={totalEntries !== totalGames ? `${totalEntries} entradas` : undefined} />
            <StatCard label="Jugando" value={playing} accent="text-violet-200" />
            <StatCard label="Completados" value={completed} accent="text-lime" />
            <StatCard label={avgScore > 0 ? "Nota media" : "Favoritos"} value={avgScore > 0 ? avgScore.toFixed(1) : favorites} accent={avgScore > 0 ? "text-lime" : "text-pink-200"} suffix={avgScore > 0 ? "★" : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, hint, suffix }: { label: string; value: number | string; accent: string; hint?: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.08] sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 sm:text-[11px]">{label}</p>
      <p className={cn("mt-1 flex items-baseline gap-1 text-2xl font-black tabular-nums sm:text-3xl", accent)}>
        {value}
        {suffix && <span className="text-base sm:text-lg">{suffix}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[10px] font-medium text-white/50">{hint}</p>}
    </div>
  );
}

function StatusChip({
  label,
  count,
  active,
  onClick,
  icon,
  activeClass
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-200",
        active
          ? cn("bg-gradient-to-br shadow-[0_0_24px_rgba(59,130,246,0.18)]", activeClass)
          : "border-white/10 bg-white/[0.04] text-muted hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
      )}
    >
      <span className={cn("transition", active ? "" : "text-muted/60")}>{icon}</span>
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums leading-none",
          active ? "bg-black/30 text-current" : "bg-white/[0.06] text-muted"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function GameGrid({ items }: { items: LibraryItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => item.game && (
        <GameCardCover key={`${item.status}-${item.game.slug}`} item={item as LibraryItem & { game: Game }} />
      ))}
    </div>
  );
}

function GameCardCover({ item }: { item: LibraryItem & { game: Game } }) {
  const meta = STATUS_META[item.status];
  return (
    <Link
      href={`/games/${item.game.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-surface/85 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-electric/50 hover:shadow-[0_20px_50px_rgba(59,130,246,0.25)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
        {item.game.coverUrl ? (
          <Image
            src={item.game.coverUrl}
            alt={item.game.title}
            fill
            sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-electric/30 via-violet/20 to-lime/10 p-4 text-center text-sm font-black text-white/80">
            {item.game.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" aria-hidden="true" />

        <div className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full border bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur"
          style={{}}
        >
          <span className={cn("inline-flex items-center gap-1.5", meta.pill, "border-0 bg-transparent px-0 py-0")}>
            {meta.icon}
            <span>{meta.short}</span>
          </span>
        </div>

        {item.game.userScore > 0 && (
          <div className="absolute right-2 top-2">
            <RatingBadge score={item.game.userScore} compact />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow-md">{item.game.title}</h3>
          <p className="mt-1 text-[11px] font-medium text-white/70">
            {item.game.year > 0 ? item.game.year : "TBA"}
            <span className="mx-1.5 text-white/40">·</span>
            Añadido {formatRelativeDate(item.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function GameList({ items }: { items: LibraryItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => item.game && (
        <GameCardRow key={`${item.status}-${item.game.slug}`} item={item as LibraryItem & { game: Game }} />
      ))}
    </div>
  );
}

function GameCardRow({ item }: { item: LibraryItem & { game: Game } }) {
  const meta = STATUS_META[item.status];
  return (
    <Link
      href={`/games/${item.game.slug}`}
      className="group relative grid gap-3 overflow-hidden rounded-2xl border border-white/10 bg-surface/85 p-3 shadow-card backdrop-blur transition-all duration-200 hover:border-electric/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] sm:grid-cols-[64px_1fr_auto] sm:items-center sm:gap-4"
    >
      <div className="absolute inset-y-0 left-0 w-1 origin-left scale-y-0 bg-gradient-to-b from-electric via-violet to-lime transition-transform duration-300 group-hover:scale-y-100" aria-hidden="true" />
      <div className="relative aspect-[3/4] w-16 overflow-hidden rounded-xl bg-white/5">
        {item.game.coverUrl ? (
          <Image
            src={item.game.coverUrl}
            alt={item.game.title}
            fill
            sizes="64px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-electric/30 to-violet/20 p-2 text-center text-[10px] font-black text-white/80">
            {item.game.title.slice(0, 2)}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold transition-colors group-hover:text-electric">{item.game.title}</h3>
          <span className="text-xs font-medium text-muted">{item.game.year > 0 ? item.game.year : "TBA"}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Añadido el {new Intl.DateTimeFormat("es").format(new Date(item.createdAt))}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", meta.pill)}>
          {meta.icon}
          {meta.short}
        </span>
        {item.game.userScore > 0 && <RatingBadge score={item.game.userScore} label="Usuarios" />}
      </div>
    </Link>
  );
}

function EmptyLibrary({ activeStatus, hasQuery }: { activeStatus: UserGameStatus | "all"; hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="grid place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-muted">
          <SearchIcon />
        </div>
        <p className="text-base font-black">Sin coincidencias</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Prueba con otra búsqueda o cambia de pestaña.</p>
      </div>
    );
  }

  const label = activeStatus === "all" ? "tu biblioteca" : STATUS_META[activeStatus].label.toLowerCase();
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-muted">
        <BookmarkIcon />
      </div>
      <p className="text-base font-black">Aún no hay juegos en {label}</p>
      <p className="mx-auto mt-1 mb-5 max-w-sm text-sm text-muted">
        Marca un juego desde su ficha como pendiente, jugando o favorito y aparecerá aquí.
      </p>
      <Button asChild href="/games" variant="primary">Explorar juegos</Button>
    </div>
  );
}

function LibrarySkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="h-20 w-16 shrink-0 animate-pulse rounded-xl bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-white/5" />
            </div>
            <div className="h-7 w-24 animate-pulse rounded-full bg-white/5" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
  );
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)}mes`;
  return `hace ${Math.floor(days / 365)}a`;
}

function BookmarkIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3 5 6.5 5c2 0 3.5 1.1 4.5 2.5C12 6.1 13.5 5 15.5 5 19 5 21 8.4 21.5 11.8 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l9 5-9 5-9-5 9-5z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1.4" />
      <rect x="14" y="3" width="7" height="7" rx="1.4" />
      <rect x="3" y="14" width="7" height="7" rx="1.4" />
      <rect x="14" y="14" width="7" height="7" rx="1.4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

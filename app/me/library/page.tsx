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
  const [featuredSlug, setFeaturedSlug] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingFeatured, setSavingFeatured] = useState(false);

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
        setFeaturedSlug(payload.featuredGameSlug ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const favoriteItems = useMemo(() => {
    const seen = new Set<string>();
    const acc: Array<LibraryItem & { game: Game }> = [];
    for (const item of items) {
      if (item.status !== "favorite" || !item.game) continue;
      if (seen.has(item.game.slug)) continue;
      seen.add(item.game.slug);
      acc.push(item as LibraryItem & { game: Game });
    }
    return acc;
  }, [items]);

  async function saveFeatured(nextSlug: string | null) {
    setSavingFeatured(true);
    try {
      const authClient = createBrowserAuthClient();
      const { data } = await authClient.auth.getSession();
      if (!data.session?.access_token) return;
      const init: RequestInit = {
        method: nextSlug ? "PUT" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`
        }
      };
      if (nextSlug) init.body = JSON.stringify({ slug: nextSlug });
      const response = await fetch("/api/me/featured-game", init);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo guardar el juego favorito.");
      setFeaturedSlug(payload?.featuredGameSlug ?? null);
      setPickerOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el juego favorito.");
    } finally {
      setSavingFeatured(false);
    }
  }

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
    if (featuredSlug) {
      const picked = favoriteItems.find((item) => item.game.slug === featuredSlug);
      if (picked) return picked.game;
    }
    return favoriteItems[0]?.game ?? null;
  }, [favoriteItems, featuredSlug]);

  const hasExplicitFeatured = Boolean(
    featuredSlug && favoriteItems.some((item) => item.game.slug === featuredSlug)
  );

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
        hasExplicitFeatured={hasExplicitFeatured}
        favoriteCount={favoriteItems.length}
        onPickFeatured={() => setPickerOpen(true)}
      />

      {pickerOpen && (
        <FeaturedGamePicker
          favorites={favoriteItems}
          currentSlug={featuredSlug}
          saving={savingFeatured}
          onClose={() => setPickerOpen(false)}
          onSelect={(slug) => saveFeatured(slug)}
          onClear={() => saveFeatured(null)}
        />
      )}

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-surface/95 via-surface/85 to-surface/95 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl md:grid-cols-[1fr_auto] md:items-center">
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-muted transition-colors group-focus-within:text-electric">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en tu biblioteca..."
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-foreground placeholder:text-muted transition-all focus:border-electric/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
                className="absolute inset-y-0 right-3 my-auto grid h-6 w-6 place-items-center rounded-full bg-white/[0.06] text-muted transition hover:bg-white/[0.12] hover:text-foreground"
              >
                <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex h-11 items-center gap-3 md:justify-end">
            <p className="hidden text-xs font-medium text-muted sm:block">
              <span className="font-black text-foreground tabular-nums">{filtered.length}</span> resultado{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="ml-auto flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Vista de cuadrícula"
                title="Vista de cuadrícula"
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition-all",
                  view === "grid" ? "bg-gradient-to-br from-electric to-electric/80 text-white shadow-[0_0_18px_rgba(59,130,246,0.5)]" : "text-muted hover:bg-white/[0.06] hover:text-foreground"
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
                  "grid h-8 w-8 place-items-center rounded-lg transition-all",
                  view === "list" ? "bg-gradient-to-br from-electric to-electric/80 text-white shadow-[0_0_18px_rgba(59,130,246,0.5)]" : "text-muted hover:bg-white/[0.06] hover:text-foreground"
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
        activeStatus === "all"
          ? <GroupedByStatus items={filtered} view={view} />
          : (view === "grid" ? <GameGrid items={filtered} /> : <GameList items={filtered} />)
      )}
    </section>
  );
}

function GroupedByStatus({ items, view }: { items: LibraryItem[]; view: "grid" | "list" }) {
  const groups = useMemo(() => {
    const map = new Map<UserGameStatus, LibraryItem[]>();
    for (const item of items) {
      if (!item.game) continue;
      const arr = map.get(item.status) ?? [];
      arr.push(item);
      map.set(item.status, arr);
    }
    return STATUS_ORDER
      .map((status) => ({ status, list: map.get(status) ?? [] }))
      .filter((group) => group.list.length > 0);
  }, [items]);

  return (
    <div className="space-y-10">
      {groups.map(({ status, list }) => (
        <StatusSection key={status} status={status} items={list} view={view} />
      ))}
    </div>
  );
}

const STATUS_SECTION_STYLES: Record<UserGameStatus, { ring: string; glow: string; chip: string; bar: string; accent: string }> = {
  want_to_play: {
    ring: "border-electric/25",
    glow: "from-electric/10 via-transparent to-transparent",
    chip: "border-electric/40 bg-electric/15 text-blue-200",
    bar: "from-electric via-electric/60 to-transparent",
    accent: "text-electric"
  },
  playing: {
    ring: "border-violet/30",
    glow: "from-violet/15 via-transparent to-transparent",
    chip: "border-violet/40 bg-violet/15 text-violet-200",
    bar: "from-violet via-violet/60 to-transparent",
    accent: "text-violet-200"
  },
  completed: {
    ring: "border-lime/25",
    glow: "from-lime/10 via-transparent to-transparent",
    chip: "border-lime/40 bg-lime/15 text-lime",
    bar: "from-lime via-lime/60 to-transparent",
    accent: "text-lime"
  },
  paused: {
    ring: "border-amber-400/25",
    glow: "from-amber-400/10 via-transparent to-transparent",
    chip: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    bar: "from-amber-400 via-amber-400/60 to-transparent",
    accent: "text-amber-300"
  },
  dropped: {
    ring: "border-danger/25",
    glow: "from-danger/10 via-transparent to-transparent",
    chip: "border-danger/40 bg-danger/15 text-danger",
    bar: "from-danger via-danger/60 to-transparent",
    accent: "text-danger"
  },
  favorite: {
    ring: "border-pink-400/30",
    glow: "from-pink-500/15 via-transparent to-transparent",
    chip: "border-pink-400/40 bg-pink-500/15 text-pink-200",
    bar: "from-pink-400 via-pink-400/60 to-transparent",
    accent: "text-pink-200"
  }
};

function StatusSection({ status, items, view }: { status: UserGameStatus; items: LibraryItem[]; view: "grid" | "list" }) {
  const meta = STATUS_META[status];
  const styles = STATUS_SECTION_STYLES[status];
  return (
    <section
      aria-label={meta.label}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-gradient-to-br from-surface/60 via-surface/30 to-transparent p-4 sm:p-5",
        styles.ring
      )}
    >
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70", styles.glow)}
      />
      <div className="relative mb-5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={cn("h-8 w-1 rounded-full bg-gradient-to-b", styles.bar)} />
          <div>
            <div className={cn(
              "mb-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur",
              styles.chip
            )}>
              {meta.icon}
              <span>{meta.short}</span>
            </div>
            <h2 className={cn("text-xl font-black tracking-tight sm:text-2xl", styles.accent)}>{meta.label}</h2>
          </div>
        </div>
        <p className="shrink-0 text-xs font-medium text-muted">
          <span className="text-base font-black tabular-nums text-foreground">{items.length}</span>{" "}
          {items.length === 1 ? "juego" : "juegos"}
        </p>
      </div>
      <div className="relative">
        {view === "grid" ? <GameGrid items={items} /> : <GameList items={items} />}
      </div>
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
  heroGame,
  hasExplicitFeatured,
  favoriteCount,
  onPickFeatured
}: {
  totalGames: number;
  totalEntries: number;
  completed: number;
  playing: number;
  favorites: number;
  avgScore: number;
  heroGame: Game | null;
  hasExplicitFeatured: boolean;
  favoriteCount: number;
  onPickFeatured: () => void;
}) {
  const heroImage = heroGame?.heroUrl || heroGame?.coverUrl || null;

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      <div className="relative min-h-[320px]">
        {heroImage ? (
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-105 object-cover blur-[2px]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-electric/40 via-violet/30 to-lime/20" />
        )}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,10,18,0.65) 0%, rgba(8,10,18,0.78) 45%, rgba(8,10,18,0.98) 100%), linear-gradient(90deg, rgba(8,10,18,0.92) 0%, rgba(8,10,18,0.45) 55%, rgba(8,10,18,0.25) 100%)"
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at 12% 25%, rgba(59,130,246,0.35), transparent 50%), radial-gradient(circle at 85% 85%, rgba(139,92,246,0.28), transparent 55%), radial-gradient(circle at 65% 15%, rgba(163,230,53,0.15), transparent 45%)"
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "44px 44px"
          }}
        />

        <div className="relative flex flex-col gap-7 p-6 sm:p-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1 backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric shadow-[0_0_8px_rgba(59,130,246,0.8)]" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-electric">Biblioteca personal</p>
              </div>
              <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-5xl lg:text-6xl">
                Mi <span className="bg-gradient-to-r from-electric via-violet-300 to-lime bg-clip-text text-transparent">biblioteca</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
                Organiza pendientes, juegos en curso, completados y favoritos desde cada ficha de juego.
              </p>
            </div>
            <FeaturedGameCard
              heroGame={heroGame}
              hasExplicitFeatured={hasExplicitFeatured}
              favoriteCount={favoriteCount}
              onPick={onPickFeatured}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <StatCard
              label="Juegos"
              value={totalGames}
              accent="text-foreground"
              accentBg="from-white/[0.08] to-white/[0.02]"
              icon={<StackIcon />}
              hint={totalEntries !== totalGames ? `${totalEntries} entradas` : undefined}
            />
            <StatCard
              label="Jugando"
              value={playing}
              accent="text-violet-200"
              accentBg="from-violet-500/15 to-violet-500/[0.02]"
              icon={<PlayIcon />}
            />
            <StatCard
              label="Completados"
              value={completed}
              accent="text-lime"
              accentBg="from-lime-400/15 to-lime-400/[0.02]"
              icon={<TrophyIcon />}
            />
            <StatCard
              label={avgScore > 0 ? "Nota media" : "Favoritos"}
              value={avgScore > 0 ? avgScore.toFixed(1) : favorites}
              accent={avgScore > 0 ? "text-lime" : "text-pink-200"}
              accentBg={avgScore > 0 ? "from-lime-400/15 to-lime-400/[0.02]" : "from-pink-500/15 to-pink-500/[0.02]"}
              icon={avgScore > 0 ? <StarIcon /> : <HeartIcon />}
              suffix={avgScore > 0 ? "★" : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, accentBg, hint, suffix, icon }: { label: string; value: number | string; accent: string; accentBg?: string; hint?: string; suffix?: string; icon?: React.ReactNode }) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-3 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] sm:p-4",
      accentBg ?? "from-white/[0.05] to-white/[0.02]"
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 sm:text-[11px]">{label}</p>
        {icon && <span className={cn("opacity-70 transition group-hover:opacity-100", accent)}>{icon}</span>}
      </div>
      <p className={cn("mt-1.5 flex items-baseline gap-1 text-2xl font-black tabular-nums sm:text-3xl", accent)}>
        {value}
        {suffix && <span className="text-base sm:text-lg">{suffix}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[10px] font-medium text-white/50">{hint}</p>}
    </div>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
    </svg>
  );
}

function FeaturedGameCard({
  heroGame,
  hasExplicitFeatured,
  favoriteCount,
  onPick
}: {
  heroGame: Game | null;
  hasExplicitFeatured: boolean;
  favoriteCount: number;
  onPick: () => void;
}) {
  if (!heroGame) {
    if (favoriteCount === 0) {
      return (
        <div className="hidden shrink-0 max-w-[280px] flex-col gap-2 rounded-2xl border border-pink-400/20 bg-pink-500/[0.06] px-4 py-3 backdrop-blur-xl lg:flex">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-200/80">Juego favorito</p>
          <p className="text-xs leading-relaxed text-white/65">
            Marca un juego como favorito desde su ficha y podrás destacarlo aquí.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className="group hidden shrink-0 items-center gap-3 rounded-2xl border border-pink-400/25 bg-black/35 px-4 py-3 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-pink-400/50 hover:bg-black/50 hover:shadow-[0_12px_32px_rgba(244,114,182,0.2)] focus-visible:border-pink-400/60 lg:flex"
    >
      {heroGame.coverUrl ? (
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15 transition group-hover:ring-pink-400/40">
          <Image src={heroGame.coverUrl} alt={heroGame.title} fill sizes="48px" className="object-cover" />
        </div>
      ) : (
        <div className="grid h-16 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-pink-500/30 to-violet/20 text-[10px] font-black text-white/80">
          {heroGame.title.slice(0, 2)}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <HeartIcon />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-200">Juego favorito</p>
        </div>
        <p className="mt-0.5 line-clamp-1 max-w-[200px] text-sm font-bold text-white">{heroGame.title}</p>
        <p className="mt-0.5 text-[10px] font-medium text-white/55">
          {hasExplicitFeatured ? "Toca para cambiar" : "Toca para elegir uno"}
        </p>
      </div>
      <span className="ml-1 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-pink-200" aria-hidden>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </button>
  );
}

function FeaturedGamePicker({
  favorites,
  currentSlug,
  saving,
  onClose,
  onSelect,
  onClear
}: {
  favorites: Array<LibraryItem & { game: Game }>;
  currentSlug: string | null;
  saving: boolean;
  onClose: () => void;
  onSelect: (slug: string) => void;
  onClear: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-surface/95 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-2.5 py-0.5">
              <HeartIcon />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-200">Juego favorito</p>
            </div>
            <h2 className="text-xl font-black text-white sm:text-2xl">Elige tu juego favorito</h2>
            <p className="mt-1 text-sm text-muted">
              Solo uno puede destacar a la vez. Aparecerá en tu hero de biblioteca.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted transition hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 sm:p-6">
          {favorites.length === 0 ? (
            <div className="grid place-items-center px-4 py-12 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-pink-400/30 bg-pink-500/10 text-pink-200">
                <HeartIcon />
              </div>
              <p className="text-base font-black">Aún no tienes favoritos</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Marca un juego como favorito desde su ficha y vuelve aquí para destacarlo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {favorites.map((item) => {
                const isActive = item.game.slug === currentSlug;
                return (
                  <button
                    key={item.game.slug}
                    type="button"
                    disabled={saving}
                    onClick={() => onSelect(item.game.slug)}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border bg-surface/85 text-left transition-all duration-200 disabled:cursor-wait disabled:opacity-60",
                      isActive
                        ? "border-pink-400/60 shadow-[0_0_30px_rgba(244,114,182,0.35)]"
                        : "border-white/10 hover:-translate-y-1 hover:border-pink-400/40 hover:shadow-[0_12px_32px_rgba(244,114,182,0.2)]"
                    )}
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
                      {item.game.coverUrl ? (
                        <Image
                          src={item.game.coverUrl}
                          alt={item.game.title}
                          fill
                          sizes="(min-width: 768px) 25vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-pink-500/30 to-violet/20 p-3 text-center text-xs font-black text-white/80">
                          {item.game.title}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden />
                      {isActive && (
                        <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-pink-500 text-white shadow-[0_4px_12px_rgba(244,114,182,0.5)]">
                          <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-2.5">
                        <h3 className="line-clamp-2 text-xs font-black leading-tight text-white drop-shadow-md">{item.game.title}</h3>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {currentSlug && favorites.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 p-4 sm:px-6">
            <p className="text-xs text-muted">¿No quieres ninguno destacado?</p>
            <button
              type="button"
              onClick={onClear}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
            >
              Quitar destacado
            </button>
          </div>
        )}
      </div>
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
        "group inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
        active
          ? cn("bg-gradient-to-br shadow-[0_0_24px_rgba(59,130,246,0.22)]", activeClass)
          : "border-white/10 bg-white/[0.04] text-muted hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] hover:text-foreground"
      )}
    >
      <span className={cn("transition", active ? "" : "text-muted/60 group-hover:text-foreground/80")}>{icon}</span>
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums leading-none transition",
          active ? "bg-black/30 text-current" : "bg-white/[0.06] text-muted group-hover:bg-white/[0.1]"
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
      {items.map((item, idx) => item.game && (
        <GameCardCover
          key={`${item.status}-${item.game.slug}`}
          item={item as LibraryItem & { game: Game }}
          index={idx}
        />
      ))}
    </div>
  );
}

function GameCardCover({ item, index }: { item: LibraryItem & { game: Game }; index: number }) {
  const meta = STATUS_META[item.status];
  return (
    <Link
      href={`/games/${item.game.slug}`}
      style={{ animationDelay: `${Math.min(index * 30, 400)}ms` }}
      className="library-card group relative block overflow-hidden rounded-2xl border border-white/10 bg-surface/85 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-electric/50 hover:shadow-[0_24px_60px_rgba(59,130,246,0.28)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
        {item.game.coverUrl ? (
          <Image
            src={item.game.coverUrl}
            alt={item.game.title}
            fill
            sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-electric/30 via-violet/20 to-lime/10 p-4 text-center text-sm font-black text-white/80">
            {item.game.title}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent transition-opacity duration-300 group-hover:from-black/90" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true"
          style={{ background: "radial-gradient(circle at 50% 0%, rgba(59,130,246,0.18), transparent 60%)" }}
        />

        <div className={cn(
          "absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
          meta.pill
        )}>
          {meta.icon}
          <span>{meta.short}</span>
        </div>

        {item.game.userScore > 0 && (
          <div className="absolute right-2 top-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
            <RatingBadge score={item.game.userScore} compact />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 translate-y-0 p-3 transition-transform duration-300">
          <h3 className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{item.game.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-white/75">
            <span className="tabular-nums">{item.game.year > 0 ? item.game.year : "TBA"}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/40" aria-hidden />
            <span>Añadido {formatRelativeDate(item.createdAt)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

function GameList({ items }: { items: LibraryItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, idx) => item.game && (
        <GameCardRow
          key={`${item.status}-${item.game.slug}`}
          item={item as LibraryItem & { game: Game }}
          index={idx}
        />
      ))}
    </div>
  );
}

function GameCardRow({ item, index }: { item: LibraryItem & { game: Game }; index: number }) {
  const meta = STATUS_META[item.status];
  return (
    <Link
      href={`/games/${item.game.slug}`}
      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
      className="library-card group relative grid gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-surface/90 via-surface/85 to-surface/90 p-3 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-electric/40 hover:shadow-[0_8px_30px_rgba(59,130,246,0.18)] sm:grid-cols-[72px_1fr_auto] sm:items-center sm:gap-4"
    >
      <div className="absolute inset-y-0 left-0 w-1 origin-left scale-y-0 bg-gradient-to-b from-electric via-violet to-lime transition-transform duration-300 group-hover:scale-y-100" aria-hidden="true" />
      <div className="relative aspect-[3/4] w-[72px] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/5 transition group-hover:ring-electric/30">
        {item.game.coverUrl ? (
          <Image
            src={item.game.coverUrl}
            alt={item.game.title}
            fill
            sizes="72px"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
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
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted">{item.game.year > 0 ? item.game.year : "TBA"}</span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <svg aria-hidden="true" className="h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Añadido el {new Intl.DateTimeFormat("es").format(new Date(item.createdAt))}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", meta.pill)}>
          {meta.icon}
          {meta.short}
        </span>
        {item.game.userScore > 0 && <RatingBadge score={item.game.userScore} label="Usuarios" />}
        <span className="hidden text-muted transition group-hover:translate-x-0.5 group-hover:text-electric sm:inline" aria-hidden>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
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

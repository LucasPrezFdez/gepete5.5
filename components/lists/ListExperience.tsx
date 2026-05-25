"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Game, GameList } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { ReportButton } from "@/components/feedback/ReportButton";
import { createBrowserAuthClient } from "@/services/auth-browser";
import { buildAuthRedirectUrl } from "@/hooks/useAuthSession";
import { cn } from "@/lib/utils";

type Permissions = {
  isOwner: boolean;
  isCollaborator: boolean;
  canView: boolean;
  canEditItems: boolean;
  canManage: boolean;
};

type Collaborator = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "editor";
  createdAt: string | null;
};

type Props = {
  slug: string;
  initialList?: GameList | null;
};

const DEFAULT_PERMISSIONS: Permissions = {
  isOwner: false,
  isCollaborator: false,
  canView: Boolean(false),
  canEditItems: false,
  canManage: false
};

export function ListExperience({ slug, initialList = null }: Props) {
  const [list, setList] = useState<GameList | null>(initialList);
  const [permissions, setPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS, canView: Boolean(initialList?.isPublic) });
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialList);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [minScore, setMinScore] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const loadList = useCallback(async (token?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(slug)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store"
      });
      if (response.status === 404) {
        if (!initialList) {
          setError("Lista no encontrada.");
        }
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo cargar la lista.");
      setList(payload.list);
      setPermissions(payload.permissions ?? DEFAULT_PERMISSIONS);
      setCollaborators(payload.collaborators ?? []);
    } catch (loadError) {
      if (!initialList) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la lista.");
      }
    } finally {
      setLoading(false);
    }
  }, [slug, initialList]);

  useEffect(() => {
    let mounted = true;
    let authClient: ReturnType<typeof createBrowserAuthClient> | null = null;

    async function boot() {
      try {
        authClient = createBrowserAuthClient();
        const { data } = await authClient.auth.getSession();
        if (!mounted) return;
        const token = data.session?.access_token ?? null;
        setAccessToken(token);
        await loadList(token);
      } catch {
        await loadList(null);
      }
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, [loadList]);

  const games = useMemo(() => list?.items.map((item) => item.game).filter(Boolean) ?? [], [list]);
  const genres = useMemo(() => unique(games.flatMap((game) => game.genres)), [games]);
  const platforms = useMemo(() => unique(games.flatMap((game) => game.platforms)), [games]);
  const filteredGames = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const min = minScore === "all" ? 0 : Number(minScore);
    return games.filter((game) => {
      const matchesQuery = !cleanQuery || game.title.toLowerCase().includes(cleanQuery) || game.summary.toLowerCase().includes(cleanQuery);
      const matchesGenre = genre === "all" || game.genres.includes(genre);
      const matchesPlatform = platform === "all" || game.platforms.includes(platform);
      const matchesScore = !min || game.userScore >= min;
      return matchesQuery && matchesGenre && matchesPlatform && matchesScore;
    });
  }, [games, genre, minScore, platform, query]);

  async function likeList() {
    if (!list) return;
    if (!accessToken) {
      window.location.href = buildAuthRedirectUrl(`/lists/${list.slug}`, "signin");
      return;
    }
    setMessage(null);
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo registrar el me gusta.");
      const nextLikes = Number(payload?.likesCount);
      if (Number.isFinite(nextLikes)) {
        setList({ ...list, likesCount: nextLikes });
      } else {
        setList({ ...list, likesCount: list.likesCount + 1 });
      }
      setMessage("¡Gracias por tu me gusta!");
    } catch (likeError) {
      setMessage(likeError instanceof Error ? likeError.message : "No se pudo registrar el me gusta.");
    }
  }

  async function shareList() {
    if (!list) return;
    setMessage(null);
    const url = `${window.location.origin}/lists/${list.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: list.title, text: list.description ?? "Lista de GameIndex", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado al portapapeles.");
    } catch {
      setMessage("No se pudo compartir la lista.");
    }
  }

  async function saveList(nextList: GameList) {
    if (!accessToken) throw new Error("Debes iniciar sesión.");
    const response = await fetch(`/api/lists/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ games: nextList.items.map((item) => item.game) })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "No se pudo actualizar la lista.");
    if (payload.list) setList(payload.list);
  }

  async function removeGame(gameSlug: string) {
    if (!list) return;
    setMessage(null);
    try {
      await saveList({ ...list, items: list.items.filter((item) => item.game.slug !== gameSlug) });
      setMessage("Juego eliminado de la lista.");
    } catch (removeError) {
      setMessage(removeError instanceof Error ? removeError.message : "No se pudo eliminar el juego.");
    }
  }

  if (loading && !list) {
    return <section className="container-page py-10"><div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-muted">Cargando lista...</div></section>;
  }

  if (error && !list) {
    return <section className="container-page py-10"><div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">{error}</div></section>;
  }

  if (!list) return null;

  const heroGame = games[0];
  const heroImage = heroGame?.heroUrl || heroGame?.coverUrl || null;
  const avgScore = games.length
    ? games.reduce((acc, game) => acc + (game.userScore || 0), 0) / games.length
    : 0;
  const topGenres = topItems(games.flatMap((game) => game.genres), 4);
  const ownerInitial = (list.user.displayName || list.user.username || "?").trim().charAt(0).toUpperCase();

  return (
    <section className="container-page py-10">
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 shadow-card">
        <div className="relative h-[440px] w-full sm:h-[480px]">
          {heroImage && (
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "linear-gradient(180deg, rgba(8,10,18,0.55) 0%, rgba(8,10,18,0.65) 40%, rgba(8,10,18,0.95) 100%), linear-gradient(90deg, rgba(8,10,18,0.85) 0%, rgba(8,10,18,0.35) 50%, rgba(8,10,18,0.25) 100%)"
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at 12% 30%, rgba(59,130,246,0.25), transparent 50%), radial-gradient(circle at 85% 90%, rgba(139,92,246,0.20), transparent 55%)"
            }}
          />

          <div className="relative flex h-full flex-col justify-end p-6 sm:p-10">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">
                <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                  {list.isPublic ? "Lista pública" : "Lista privada"}
                </span>
                <span className="text-white/40">·</span>
                <span>{list.items.length} juegos</span>
                {avgScore > 0 && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-lime">{avgScore.toFixed(1)} ★ nota media</span>
                  </>
                )}
                {permissions.isCollaborator && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-lime">Colaborador</span>
                  </>
                )}
              </div>

              <h1 className="mt-4 text-5xl font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-6xl lg:text-7xl">
                {list.title}
              </h1>

              {list.description && (
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 drop-shadow-md sm:text-lg">
                  {list.description}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/85">
                <Link
                  href={`/users/${list.user.username}`}
                  className="group/owner flex items-center gap-2.5 rounded-2xl px-1.5 py-1 transition hover:bg-white/10"
                >
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-electric to-violet text-xs font-black text-white ring-2 ring-white/20 transition group-hover/owner:ring-white/40">
                    {list.user.avatarUrl ? (
                      <Image src={list.user.avatarUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      ownerInitial
                    )}
                  </div>
                  <div className="leading-tight">
                    <p className="font-semibold text-white transition group-hover/owner:text-electric">{list.user.displayName || list.user.username}</p>
                    <p className="text-xs text-white/60">@{list.user.username}</p>
                  </div>
                </Link>
                <span className="hidden h-8 w-px bg-white/20 sm:block" aria-hidden="true" />
                <p className="text-white/75">
                  <span className="font-bold text-lime">{list.likesCount.toLocaleString("es-ES")}</span> me gusta
                </p>
                {topGenres.length > 0 && (
                  <>
                    <span className="hidden h-8 w-px bg-white/20 sm:block" aria-hidden="true" />
                    <div className="flex flex-wrap gap-1.5">
                      {topGenres.slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/85 backdrop-blur">
                          {item}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-2">
                <Button type="button" onClick={likeList} className="gap-2">
                  <HeartIcon /> Me gusta
                </Button>
                <Button type="button" variant="secondary" onClick={shareList} className="gap-2">
                  <ShareIcon /> Compartir
                </Button>
                {permissions.canEditItems && (
                  <Button type="button" variant="secondary" onClick={() => setAddOpen(true)} className="gap-2">
                    <PlusIcon /> Añadir juegos
                  </Button>
                )}
                {permissions.canManage && (
                  <Button type="button" variant="ghost" onClick={() => setSettingsOpen(true)} className="gap-2 text-white/80 hover:bg-white/10 hover:text-white">
                    <GearIcon /> Configuración
                  </Button>
                )}
                <ReportButton
                  targetType="list"
                  targetId={list.id}
                  authorId={list.user.id}
                  variant="secondary"
                  className="text-white/80 hover:text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {message && <p className="mb-5 rounded-xl border border-lime/30 bg-lime/10 p-3 text-sm text-lime">{message}</p>}
      {error && <p className="mb-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="sticky top-2 z-20 mb-6 grid items-center gap-3 rounded-2xl border border-white/10 bg-surface/95 p-4 shadow-card backdrop-blur md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_160px_190px_150px_auto]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en la lista..." />
        <Select value={genre} onChange={setGenre} options={["all", ...genres]} labels={{ all: "Todos los géneros" }} />
        <Select value={platform} onChange={setPlatform} options={["all", ...platforms]} labels={{ all: "Todas las plataformas" }} />
        <Select value={minScore} onChange={setMinScore} options={["all", "7", "8", "9"]} labels={{ all: "Cualquier nota", "7": "7+", "8": "8+", "9": "9+" }} />
        <div className="flex h-11 items-center gap-2 md:col-span-2 md:justify-end xl:col-span-1">
          <Button
            type="button"
            variant={view === "list" ? "primary" : "secondary"}
            onClick={() => setView("list")}
            className="h-11 w-11 px-0"
            aria-label="Ver como lista"
            title="Ver como lista"
          >
            <ListViewIcon />
          </Button>
          <Button
            type="button"
            variant={view === "grid" ? "primary" : "secondary"}
            onClick={() => setView("grid")}
            className="h-11 w-11 px-0"
            aria-label="Ver como grid"
            title="Ver como grid"
          >
            <RubikGridIcon />
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-sm text-muted">
          Mostrando <span className="font-bold text-foreground">{filteredGames.length}</span> de {games.length} juegos
        </p>
      </div>

      {filteredGames.length > 0 ? (
        view === "list" ? <ListRows games={filteredGames} canEdit={permissions.canEditItems} onRemove={removeGame} /> : <CoverGrid games={filteredGames} canEdit={permissions.canEditItems} onRemove={removeGame} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-muted">
          <p className="text-base font-semibold text-foreground">Sin coincidencias</p>
          <p className="mt-1">Prueba a ajustar los filtros o el término de búsqueda.</p>
        </div>
      )}

      {settingsOpen && accessToken && (
        <ListSettingsDialog
          accessToken={accessToken}
          list={list}
          collaborators={collaborators}
          onClose={() => setSettingsOpen(false)}
          onSaved={(nextList) => setList(nextList)}
          onCollaboratorsChange={setCollaborators}
        />
      )}
      {addOpen && accessToken && (
        <AddGamesDialog
          accessToken={accessToken}
          list={list}
          onClose={() => setAddOpen(false)}
          onSaved={(nextList) => {
            setList(nextList);
            setAddOpen(false);
          }}
        />
      )}
    </section>
  );
}

function ListRows({ games, canEdit, onRemove }: { games: Game[]; canEdit: boolean; onRemove: (slug: string) => void }) {
  return (
    <div className="space-y-2">
      {games.map((game, index) => (
        <article
          key={game.slug}
          className="group relative grid gap-3 overflow-hidden rounded-xl border border-white/10 bg-surface/85 p-2.5 shadow-card backdrop-blur transition-all duration-200 hover:border-electric/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] sm:grid-cols-[36px_56px_1fr_auto] sm:items-center sm:gap-4"
        >
          <div className="absolute inset-y-0 left-0 w-1 origin-left scale-y-0 bg-gradient-to-b from-electric via-violet to-lime transition-transform duration-300 group-hover:scale-y-100" aria-hidden="true" />
          <RankNumber index={index} />
          <Link href={`/games/${game.slug}`} className="relative aspect-[3/4] w-14 overflow-hidden rounded-lg bg-white/5">
            {game.coverUrl && (
              <Image
                src={game.coverUrl}
                alt={`Cover de ${game.title}`}
                fill
                sizes="56px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )}
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/games/${game.slug}`} className="text-base font-bold transition-colors group-hover:text-electric">
                {game.title}
              </Link>
              <span className="text-xs font-medium text-muted">{game.year > 0 ? game.year : "TBA"}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">
              {game.developer}
              {game.platforms.length ? ` · ${game.platforms.slice(0, 3).join(", ")}` : ""}
              {game.genres.length ? ` · ${game.genres.slice(0, 2).join(", ")}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <RatingBadge score={game.userScore} label="Usuarios" />
            {canEdit && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(game.slug)}>
                Quitar
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function CoverGrid({ games, canEdit, onRemove }: { games: Game[]; canEdit: boolean; onRemove: (slug: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {games.map((game, index) => (
        <article
          key={game.slug}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-surface/85 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-electric/50 hover:shadow-[0_20px_50px_rgba(59,130,246,0.25)]"
        >
          <Link href={`/games/${game.slug}`} className="block">
            <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
              {game.coverUrl && (
                <Image
                  src={game.coverUrl}
                  alt={game.title}
                  fill
                  sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden="true" />
              <div className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/70 text-xs font-black text-white shadow-lg backdrop-blur">
                #{index + 1}
              </div>
              <div className="absolute right-2 top-2">
                <RatingBadge score={game.userScore} compact />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <h3 className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow-md">{game.title}</h3>
                <p className="mt-1 text-[11px] font-medium text-white/70">{game.year > 0 ? game.year : "TBA"}{game.platforms[0] ? ` · ${game.platforms[0]}` : ""}</p>
              </div>
            </div>
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={() => onRemove(game.slug)}
              className="absolute right-2 bottom-2 rounded-full bg-danger/85 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
            >
              Quitar
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function RankNumber({ index }: { index: number }) {
  const rank = index + 1;
  const isTop3 = rank <= 3;
  return (
    <div className="hidden sm:flex sm:items-center sm:justify-center">
      <span
        className={cn(
          "text-2xl font-black tabular-nums leading-none",
          isTop3
            ? "bg-gradient-to-br from-lime via-electric to-violet bg-clip-text text-transparent"
            : "text-white/25"
        )}
      >
        {rank.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

function topItems(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([name]) => name);
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3 5 6.5 5c2 0 3.5 1.1 4.5 2.5C12 6.1 13.5 5 15.5 5 19 5 21 8.4 21.5 11.8 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function ListSettingsDialog({
  accessToken,
  list,
  collaborators,
  onClose,
  onSaved,
  onCollaboratorsChange
}: {
  accessToken: string;
  list: GameList;
  collaborators: Collaborator[];
  onClose: () => void;
  onSaved: (list: GameList) => void;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
}) {
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description ?? "");
  const [isPublic, setIsPublic] = useState(list.isPublic);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(list.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title, description, isPublic })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo guardar la configuración.");
      if (payload.list) onSaved(payload.list);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function addCollaborator() {
    setError(null);
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(list.slug)}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ username })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo añadir el colaborador.");
      onCollaboratorsChange(payload.collaborators ?? []);
      setUsername("");
    } catch (collabError) {
      setError(collabError instanceof Error ? collabError.message : "No se pudo añadir el colaborador.");
    }
  }

  async function removeCollaborator(nextUsername: string) {
    setError(null);
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(list.slug)}/collaborators`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ username: nextUsername })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo quitar el colaborador.");
      onCollaboratorsChange(payload.collaborators ?? []);
    } catch (collabError) {
      setError(collabError instanceof Error ? collabError.message : "No se pudo quitar el colaborador.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Configuración de lista">
      <div className="surface-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">Configuración</p>
            <h2 className="text-2xl font-black">Ajustes de la lista</h2>
          </div>
          <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={saveSettings} className="space-y-5">
          <Field label="Título"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Descripción">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted transition focus:border-electric focus:outline-none" />
          </Field>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-4 w-4 accent-blue-500" />
            <span><span className="font-semibold">Lista pública</span><span className="block text-muted">Si está desactivada, solo tú y tus colaboradores podéis verla.</span></span>
          </label>
          <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar configuración"}</Button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6">
          <h3 className="font-bold">Colaboradores</h3>
          <p className="mt-2 text-sm text-muted">Los colaboradores pueden añadir o quitar juegos, pero no cambiar la configuración.</p>
          <div className="mt-4 flex gap-2">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@usuario" />
            <Button type="button" onClick={addCollaborator}>Añadir</Button>
          </div>
          <div className="mt-4 space-y-2">
            {collaborators.length ? collaborators.map((item) => (
              <div key={item.username} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                <div><p className="font-semibold">{item.displayName}</p><p className="text-sm text-muted">@{item.username} · editor</p></div>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeCollaborator(item.username)}>Quitar</Button>
              </div>
            )) : <p className="text-sm text-muted">No hay colaboradores todavía.</p>}
          </div>
        </div>
        {error && <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

function AddGamesDialog({ accessToken, list, onClose, onSaved }: { accessToken: string; list: GameList; onClose: () => void; onSaved: (list: GameList) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  const listedSlugs = useMemo(() => new Set(list.items.map((item) => item.game.slug)), [list.items]);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/games?q=${encodeURIComponent(trimmedQuery)}&pageSize=12`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.error) throw new Error(payload?.error ?? "No se pudo buscar juegos.");
        setResults(payload.games ?? []);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setError(searchError instanceof Error ? searchError.message : "No se pudo buscar juegos.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addGame(game: Game) {
    setError(null);
    setAddingSlug(game.slug);
    try {
      const nextGames = [...list.items.map((item) => item.game).filter((item) => item.slug !== game.slug), game];
      const response = await fetch(`/api/lists/${encodeURIComponent(list.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ games: nextGames })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo añadir el juego.");
      if (payload.list) onSaved(payload.list);
      setRecentlyAdded((prev) => new Set(prev).add(game.slug));
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "No se pudo añadir el juego.");
    } finally {
      setAddingSlug(null);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Añadir juegos">
        <div className="relative my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/95 shadow-card backdrop-blur" style={{ maxHeight: "min(90vh, 760px)" }}>
          {/* Banner */}
          <div className="relative h-24 shrink-0 overflow-hidden md:h-28">
            <div className="absolute inset-0 bg-gradient-to-br from-electric/35 via-violet/30 to-lime/25" />
            <div className="absolute -left-16 -top-12 h-44 w-44 rounded-full bg-electric/30 blur-3xl" />
            <div className="absolute -right-12 top-6 h-44 w-44 rounded-full bg-violet/25 blur-3xl" />
            <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-lime/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                backgroundSize: "32px 32px"
              }}
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface/95 to-transparent" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/40 text-muted backdrop-blur transition hover:border-white/30 hover:bg-black/60 hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* Header + search */}
          <div className="relative shrink-0 px-6 pb-5 pt-2 md:px-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-electric">Juegos</p>
                </div>
                <h2 className="text-2xl font-black md:text-3xl">Añadir juegos</h2>
                <p className="mt-1 text-sm text-muted">Busca y añádelos a <span className="text-foreground">{list.title}</span>.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
                <span className="font-mono font-bold tabular-nums text-foreground">{list.items.length}</span>
                <span className="ml-1 text-muted">en la lista</span>
              </div>
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="20" y1="20" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca por título, saga, estudio..."
                autoFocus
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-11 pr-24 text-sm text-foreground placeholder:text-muted transition focus:border-electric/60 focus:bg-white/[0.09] focus:outline-none"
              />
              <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                {loading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-electric/30 border-t-electric" aria-hidden />
                )}
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpiar búsqueda"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
            )}
          </div>

          {/* Results scroll area */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 md:px-8">
            {!trimmedQuery && !loading ? (
              <AddGamesEmpty
                icon={
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="20" y1="20" x2="16.65" y2="16.65" />
                  </svg>
                }
                title="Empieza a escribir"
                description="Aparecerán resultados a medida que tecleas."
              />
            ) : loading && results.length === 0 ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="h-20 w-14 shrink-0 animate-pulse rounded-xl bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                    </div>
                    <div className="h-9 w-20 animate-pulse rounded-xl bg-white/5" />
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <AddGamesEmpty
                icon={
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="8" y1="15" x2="16" y2="15" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                }
                title="Sin resultados"
                description={`No encontramos nada para "${trimmedQuery}". Prueba con otra búsqueda.`}
              />
            ) : (
              <ul className="space-y-2.5">
                {results.map((game) => {
                  const alreadyInList = listedSlugs.has(game.slug) || recentlyAdded.has(game.slug);
                  const isAdding = addingSlug === game.slug;
                  return (
                    <li
                      key={game.slug}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl border bg-white/[0.04] p-2.5 transition",
                        alreadyInList ? "border-lime/30 bg-lime/[0.04]" : "border-white/10 hover:border-electric/40 hover:bg-white/[0.07]"
                      )}
                    >
                      <Link href={`/games/${game.slug}`} target="_blank" rel="noreferrer" className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        {game.coverUrl ? (
                          <Image src={game.coverUrl} alt="" fill sizes="56px" className="object-cover transition group-hover:scale-105" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[10px] font-bold text-muted">Sin cover</div>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link href={`/games/${game.slug}`} target="_blank" rel="noreferrer" className="font-bold transition hover:text-electric">
                            {game.title}
                          </Link>
                          <span className="text-[11px] font-medium text-muted">{game.year > 0 ? game.year : "TBA"}</span>
                          {game.userScore > 0 && <RatingBadge score={game.userScore} compact />}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {game.developer || "—"}
                          {game.platforms.length ? ` · ${game.platforms.slice(0, 3).join(", ")}` : ""}
                          {game.genres.length ? ` · ${game.genres.slice(0, 2).join(", ")}` : ""}
                        </p>
                      </div>
                      {alreadyInList ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-lime/40 bg-lime/15 px-3 py-2 text-xs font-bold text-lime">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          En la lista
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => addGame(game)}
                          disabled={isAdding}
                          className="gap-1.5"
                        >
                          {isAdding ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                              Añadiendo
                            </>
                          ) : (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                              Añadir
                            </>
                          )}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer sticky */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-surface/95 px-6 py-4 backdrop-blur md:px-8">
            <p className="text-xs text-muted">
              {recentlyAdded.size > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-lime">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {recentlyAdded.size} juego{recentlyAdded.size === 1 ? "" : "s"} añadido{recentlyAdded.size === 1 ? "" : "s"}
                </span>
              ) : (
                "Pulsa ESC para cerrar."
              )}
            </p>
            <Button type="button" variant="secondary" onClick={onClose}>
              {recentlyAdded.size > 0 ? "Hecho" : "Cerrar"}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function AddGamesEmpty({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-muted">
        {icon}
      </div>
      <p className="text-base font-black">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>
    </div>
  );
}

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-foreground transition focus:border-electric"
    >
      {options.map((option) => (
        <option key={option} value={option} className="bg-background text-foreground">
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function ListViewIcon() {
  return (
    <svg aria-hidden="true" className="h-9 w-9 shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="3.25" strokeLinecap="round" />
    </svg>
  );
}

function RubikGridIcon() {
  return (
    <svg aria-hidden="true" className="h-9 w-9 shrink-0" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="9.25" y="3" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="15.5" y="3" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="3" y="9.25" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="15.5" y="9.25" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="3" y="15.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="9.25" y="15.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="15.5" y="15.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "es"));
}

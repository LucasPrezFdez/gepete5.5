"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Game, GameList } from "@/data/games";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { createBrowserAuthClient } from "@/services/auth-browser";
import { buildAuthRedirectUrl } from "@/hooks/useAuthSession";

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

  return (
    <section className="container-page py-10">
      <div className="surface-card mb-8 overflow-hidden rounded-3xl">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <Badge tone={list.isPublic ? "violet" : "muted"}>{list.isPublic ? "Lista pública" : "Lista privada"}</Badge>
            {permissions.isCollaborator && <Badge tone="lime" className="ml-2">Colaborador</Badge>}
            <h1 className="mt-4 text-4xl font-black">{list.title}</h1>
            <p className="mt-2 text-sm text-muted">por @{list.user.username} · {list.items.length} juegos</p>
            {list.description && <p className="mt-3 max-w-2xl text-muted">{list.description}</p>}
          </div>
          <div className="flex flex-wrap items-start gap-2 md:justify-end">
            <Button type="button" onClick={shareList}>Compartir</Button>
            <Button type="button" variant="secondary" onClick={likeList}>
              Me gusta ({list.likesCount.toLocaleString("es-ES")})
            </Button>
            {permissions.canEditItems && <Button type="button" variant="secondary" onClick={() => setAddOpen(true)}>Añadir juegos</Button>}
            {permissions.canManage && <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}>Configuración</Button>}
          </div>
        </div>
      </div>

      {message && <p className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-muted">{message}</p>}
      {error && <p className="mb-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="mb-5 grid items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_160px_190px_150px_auto]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por nombre o texto..." />
        <Select value={genre} onChange={setGenre} options={["all", ...genres]} labels={{ all: "Todos los géneros" }} />
        <Select value={platform} onChange={setPlatform} options={["all", ...platforms]} labels={{ all: "Todas las plataformas" }} />
        <Select value={minScore} onChange={setMinScore} options={["all", "7", "8", "9"]} labels={{ all: "Cualquier nota", "7": "7+", "8": "8+", "9": "9+" }} />
        <div className="flex h-14 items-center gap-2 md:col-span-2 md:justify-end xl:col-span-1">
          <Button
            type="button"
            variant={view === "list" ? "primary" : "secondary"}
            onClick={() => setView("list")}
            className="h-14 w-14 px-0"
            aria-label="Ver como lista"
            title="Ver como lista"
          >
            <ListViewIcon />
          </Button>
          <Button
            type="button"
            variant={view === "grid" ? "primary" : "secondary"}
            onClick={() => setView("grid")}
            className="h-14 w-14 px-0"
            aria-label="Ver como grid"
            title="Ver como grid"
          >
            <RubikGridIcon />
          </Button>
        </div>
      </div>

      {filteredGames.length > 0 ? (
        view === "list" ? <ListRows games={filteredGames} canEdit={permissions.canEditItems} onRemove={removeGame} /> : <CoverGrid games={filteredGames} canEdit={permissions.canEditItems} onRemove={removeGame} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-muted">No hay juegos que coincidan con los filtros.</div>
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
    <div className="space-y-3">
      {games.map((game) => (
        <article key={game.slug} className="surface-card grid gap-4 rounded-2xl p-3 sm:grid-cols-[86px_1fr_auto] sm:items-center">
          <Link href={`/games/${game.slug}`} className="relative aspect-[3/4] w-20 overflow-hidden rounded-xl bg-white/5 sm:w-[86px]">
            {game.coverUrl && (
              <Image
                src={game.coverUrl}
                alt={`Cover de ${game.title}`}
                fill
                sizes="86px"
                className="object-cover"
              />
            )}
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/games/${game.slug}`} className="text-lg font-black hover:text-electric">{game.title}</Link>
              <Badge tone="muted">{game.year > 0 ? game.year : "TBA"}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{game.year > 0 ? game.year : "Fecha por anunciar"} · {game.developer} · {game.platforms.slice(0, 3).join(", ")}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{game.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {game.genres.slice(0, 4).map((item) => <Badge key={item} tone="muted">{item}</Badge>)}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <RatingBadge score={game.userScore} label="Usuarios" />
            <span className="text-xs text-muted">{game.ratings.toLocaleString("es-ES")} valoraciones</span>
            {canEdit && <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(game.slug)}>Quitar</Button>}
          </div>
        </article>
      ))}
    </div>
  );
}

function CoverGrid({ games, canEdit, onRemove }: { games: Game[]; canEdit: boolean; onRemove: (slug: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
      {games.map((game) => (
        <article key={game.slug} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 transition hover:-translate-y-1 hover:border-electric/45">
          <Link href={`/games/${game.slug}`} className="block overflow-hidden rounded-xl">
            <div className="relative aspect-[3/4] bg-background/70">
              {game.coverUrl && (
                <Image
                  src={game.coverUrl}
                  alt={game.title}
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 50vw"
                  className="object-cover transition group-hover:scale-105"
                />
              )}
            </div>
          </Link>
          {canEdit && <button type="button" onClick={() => onRemove(game.slug)} className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-1 text-xs text-white backdrop-blur">Quitar</button>}
        </article>
      ))}
    </div>
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
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground" />
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

  async function searchGames(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/games?q=${encodeURIComponent(query)}&pageSize=8`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.error) throw new Error(payload?.error ?? "No se pudo buscar juegos.");
      setResults(payload.games ?? []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "No se pudo buscar juegos.");
    } finally {
      setLoading(false);
    }
  }

  async function addGame(game: Game) {
    setError(null);
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
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "No se pudo añadir el juego.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Añadir juegos">
      <div className="surface-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">Juegos</p><h2 className="text-2xl font-black">Añadir juegos</h2></div><button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground" onClick={onClose}>Cerrar</button></div>
        <form onSubmit={searchGames} className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar juego..." /><Button type="submit" disabled={loading}>{loading ? "Buscando..." : "Buscar"}</Button></form>
        <div className="mt-5 space-y-2">
          {results.map((game) => (
            <div key={game.slug} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="relative h-16 w-12 overflow-hidden rounded-lg bg-background/60">
                {game.coverUrl && (
                  <Image src={game.coverUrl} alt="" fill sizes="48px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1"><p className="font-semibold">{game.title}</p><p className="text-sm text-muted">{game.year || "TBA"}</p></div>
              <Button type="button" size="sm" onClick={() => addGame(game)}>Añadir</Button>
            </div>
          ))}
        </div>
        {error && <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-xl border border-white/10 bg-background/80 px-3 text-sm text-foreground shadow-inner transition focus:border-electric"
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

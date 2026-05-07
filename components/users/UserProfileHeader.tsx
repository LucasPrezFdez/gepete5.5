"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, ProfileStats } from "@/data/games";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBrowserAuthClient } from "@/services/auth-browser";

const PLATFORM_OPTIONS = ["PC", "PlayStation 5", "Xbox Series", "Nintendo Switch", "Mobile"];
const GENRE_OPTIONS = ["RPG", "Acción", "Aventura", "Terror", "Indie", "Estrategia", "Metroidvania"];

type Props = {
  profile: Profile;
  stats: ProfileStats;
};

export function UserProfileHeader({ profile, stats }: Props) {
  const router = useRouter();
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [viewerProfile, setViewerProfile] = useState<Profile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [checkingViewer, setCheckingViewer] = useState(true);
  const [followers, setFollowers] = useState(stats.followerCount);
  const [following, setFollowing] = useState(stats.followingCount);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);

  const isOwnProfile = viewerProfile?.username === currentProfile.username;
  const preferences = useMemo(
    () => [...currentProfile.favoritePlatforms, ...currentProfile.favoriteGenres],
    [currentProfile.favoritePlatforms, currentProfile.favoriteGenres]
  );

  useEffect(() => {
    setCurrentProfile(profile);
    setFollowers(stats.followerCount);
    setFollowing(stats.followingCount);
  }, [profile, stats.followerCount, stats.followingCount]);

  useEffect(() => {
    let mounted = true;
    let authClient: ReturnType<typeof createBrowserAuthClient>;

    try {
      authClient = createBrowserAuthClient();
    } catch {
      return () => {
        mounted = false;
      };
    }

    async function loadViewer() {
      try {
        const { data } = await authClient.auth.getSession();
        const token = data.session?.access_token ?? null;
        if (!mounted) return;
        setAccessToken(token);

        if (!token) {
          setViewerProfile(null);
          setCheckingViewer(false);
          return;
        }

        const response = await fetch("/api/me/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = response.ok ? await response.json().catch(() => null) : null;
        if (mounted) {
          setViewerProfile(payload?.profile ?? null);
          setCheckingViewer(false);
        }
      } catch {
        if (mounted) {
          setAccessToken(null);
          setViewerProfile(null);
          setCheckingViewer(false);
        }
      }
    }

    void loadViewer();

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, nextSession) => {
      setCheckingViewer(true);
      setAccessToken(nextSession?.access_token ?? null);
      if (!nextSession?.access_token) {
        setViewerProfile(null);
        setCheckingViewer(false);
      } else {
        void loadViewer();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadFollowState() {
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
      const response = await fetch(`/api/users/${encodeURIComponent(currentProfile.username)}/follow`, { headers, cache: "no-store" }).catch(() => null);
      const payload = response?.ok ? await response.json().catch(() => null) : null;
      if (!mounted || !payload) return;
      setFollowers(Number(payload.followerCount ?? stats.followerCount));
      setFollowing(Number(payload.followingCount ?? stats.followingCount));
      setIsFollowing(Boolean(payload.isFollowing));
    }

    void loadFollowState();
    return () => {
      mounted = false;
    };
  }, [accessToken, currentProfile.username, stats.followerCount, stats.followingCount]);

  async function toggleFollow() {
    setMessage(null);
    if (!accessToken) {
      window.location.href = "/auth";
      return;
    }

    setFollowLoading(true);
    try {
      const nextEnabled = !isFollowing;
      const response = await fetch(`/api/users/${encodeURIComponent(currentProfile.username)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo actualizar el seguimiento.");
      setIsFollowing(Boolean(payload.isFollowing));
      setFollowers(Number(payload.followerCount ?? followers));
      setFollowing(Number(payload.followingCount ?? following));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el seguimiento.");
    } finally {
      setFollowLoading(false);
    }
  }

  async function shareProfile() {
    setMessage(null);
    const url = `${window.location.origin}/users/${currentProfile.username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${currentProfile.displayName} en GameIndex`, text: `Perfil de @${currentProfile.username}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado al portapapeles.");
    } catch {
      setMessage("No se pudo compartir el perfil.");
    }
  }

  return (
    <section className="surface-card overflow-hidden rounded-3xl">
      <div className="h-28 bg-gradient-to-r from-electric/30 via-violet/30 to-lime/20" />
      <div className="p-6 pt-0 md:p-8 md:pt-0">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="-mt-12 grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-electric to-violet text-3xl font-black shadow-glow">
            {currentProfile.avatarUrl ? <img src={currentProfile.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(currentProfile.displayName)}
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted">@{currentProfile.username}</p>
            <h1 className="text-3xl font-black md:text-4xl">{currentProfile.displayName}</h1>
            <p className="mt-2 max-w-2xl text-muted">
              {currentProfile.bio ?? "Perfil de GameIndex con actividad, reseñas, listas y biblioteca personal."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">{stats.ratingsCount} valorados</Badge>
              <Badge tone="lime">{stats.completedCount} completados</Badge>
              <Badge tone="violet">{stats.backlogCount} backlog</Badge>
              <Badge tone="muted">{stats.listsCount} listas públicas</Badge>
              <Badge tone="muted">{followers} seguidores</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwnProfile ? (
              <>
                <Button type="button" onClick={() => setCreateListOpen(true)}>Crear lista</Button>
                <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>Editar perfil</Button>
              </>
            ) : checkingViewer ? (
              <Button type="button" disabled>Cargando...</Button>
            ) : (
              <Button type="button" onClick={toggleFollow} disabled={followLoading} variant={isFollowing ? "secondary" : "primary"}>
                {followLoading ? "Guardando..." : isFollowing ? "Siguiendo" : "Seguir"}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={shareProfile}>Compartir</Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>Miembro desde {formatDate(currentProfile.createdAt)}</span>
          <span className="hidden text-white/20 sm:inline">•</span>
          <span>{following} siguiendo</span>
          {preferences.length > 0 && (
            <>
              <span className="hidden text-white/20 sm:inline">•</span>
              <span>{preferences.slice(0, 4).join(" · ")}</span>
            </>
          )}
        </div>
        {message && <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-muted">{message}</p>}
      </div>

      {editOpen && accessToken && (
        <EditProfileDialog
          profile={currentProfile}
          accessToken={accessToken}
          onClose={() => setEditOpen(false)}
          onSaved={(nextProfile) => {
            setCurrentProfile(nextProfile);
            setEditOpen(false);
            router.refresh();
          }}
        />
      )}
      {createListOpen && accessToken && (
        <CreateListDialog
          accessToken={accessToken}
          onClose={() => setCreateListOpen(false)}
          onCreated={(slug) => {
            setCreateListOpen(false);
            router.push(`/lists/${slug}`);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function CreateListDialog({
  accessToken,
  onClose,
  onCreated
}: {
  accessToken: string;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title, description, isPublic, games: [] })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo crear la lista.");
      onCreated(payload.slug);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la lista.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Crear lista">
      <form onSubmit={submit} className="surface-card w-full max-w-xl rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">Listas</p>
            <h2 className="text-2xl font-black">Crear lista</h2>
            <p className="mt-2 text-sm text-muted">Crea una lista vacía y después añade juegos desde sus fichas.</p>
          </div>
          <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground" onClick={onClose}>Cerrar</button>
        </div>

        <div className="space-y-5">
          <Field label="Título">
            <Input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Mis indies pendientes" />
          </Field>
          <Field label="Descripción">
            <textarea
              value={description}
              maxLength={500}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted transition focus:border-electric"
              placeholder="Explica de qué va la lista..."
            />
          </Field>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-4 w-4 accent-blue-500" />
            <span>
              <span className="font-semibold">Lista pública</span>
              <span className="block text-muted">Aparecerá en tu perfil si está activada.</span>
            </span>
          </label>
        </div>

        {error && <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Creando..." : "Crear lista"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

function EditProfileDialog({
  profile,
  accessToken,
  onClose,
  onSaved
}: {
  profile: Profile;
  accessToken: string;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [favoritePlatforms, setFavoritePlatforms] = useState(profile.favoritePlatforms);
  const [favoriteGenres, setFavoriteGenres] = useState(profile.favoriteGenres);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ displayName, bio, avatarUrl, favoritePlatforms, favoriteGenres })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo guardar el perfil.");
      onSaved(payload.profile);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Editar perfil">
      <form onSubmit={submit} className="surface-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">Mi perfil</p>
            <h2 className="text-2xl font-black">Editar perfil</h2>
            <p className="mt-2 text-sm text-muted">El nombre de usuario @{profile.username} no se puede cambiar en esta versión.</p>
          </div>
          <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground" onClick={onClose}>Cerrar</button>
        </div>

        <div className="space-y-5">
          <Field label="Nombre visible">
            <Input value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} />
          </Field>
          <Field label="Bio">
            <textarea
              value={bio}
              maxLength={300}
              rows={4}
              onChange={(event) => setBio(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted transition focus:border-electric"
              placeholder="Cuenta qué juegos te interesan..."
            />
          </Field>
          <Field label="Avatar por URL">
            <Input value={avatarUrl} maxLength={500} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
          </Field>
          <Picker title="Plataformas favoritas" values={PLATFORM_OPTIONS} selected={favoritePlatforms} onToggle={(value) => toggle(favoritePlatforms, value, setFavoritePlatforms)} />
          <Picker title="Géneros favoritos" values={GENRE_OPTIONS} selected={favoriteGenres} onToggle={(value) => toggle(favoriteGenres, value, setFavoriteGenres)} />
        </div>

        {error && <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Picker({ title, values, selected, onToggle }: { title: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <button key={value} type="button" onClick={() => onToggle(value)}>
            <Badge tone={selected.includes(value) ? "lime" : "muted"}>{value}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

function toggle(list: string[], value: string, setter: (value: string[]) => void) {
  setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
}

function initials(value: string) {
  return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha no disponible";
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Profile, ProfileStats } from "@/data/games";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBrowserAuthClient } from "@/services/auth-browser";
import { buildAuthRedirectUrl } from "@/hooks/useAuthSession";

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
      window.location.href = buildAuthRedirectUrl(`/users/${currentProfile.username}`, "signin");
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
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface/85 shadow-card backdrop-blur">
      <div className="relative h-44 md:h-56">
        <div className="absolute inset-0 bg-gradient-to-br from-electric/40 via-violet/35 to-lime/25" />
        <div className="absolute inset-0 bg-premium-radial" />
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-electric/35 blur-3xl" />
        <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-violet/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-48 w-48 rounded-full bg-lime/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }}
          aria-hidden
        />
        <span className="absolute right-8 top-6 h-3 w-3 animate-pulse rounded-full bg-lime shadow-[0_0_20px_rgba(163,230,53,0.8)]" aria-hidden />
        <span className="absolute right-14 top-7 text-[10px] font-bold uppercase tracking-[0.3em] text-lime/90">online</span>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface/95 via-surface/40 to-transparent" />
      </div>
      <div className="relative p-6 pt-0 md:p-8 md:pt-0">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="relative -mt-20 shrink-0">
            <div className="absolute -inset-1.5 rounded-[2rem] bg-gradient-to-br from-electric via-violet to-lime opacity-90 blur-md" aria-hidden />
            <div className="relative grid h-32 w-32 place-items-center overflow-hidden rounded-[1.75rem] border-2 border-white/20 bg-gradient-to-br from-electric to-violet text-4xl font-black text-white shadow-glow md:h-36 md:w-36">
              {currentProfile.avatarUrl ? (
                <Image
                  src={currentProfile.avatarUrl}
                  alt={`Avatar de ${currentProfile.displayName}`}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : (
                initials(currentProfile.displayName)
              )}
            </div>
          </div>
          <div className="flex-1 pt-4 md:pt-0">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-electric">@{currentProfile.username}</p>
            </div>
            <h1 className="text-balance text-4xl font-black leading-tight tracking-tight md:text-5xl">
              {currentProfile.displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted md:text-base">
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
          <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
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

        <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-electric" aria-hidden />
            Miembro desde {formatDate(currentProfile.createdAt)}
          </span>
          <span className="text-white/15" aria-hidden>•</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet" aria-hidden />
            {following} siguiendo
          </span>
          {preferences.length > 0 && (
            <>
              <span className="text-white/15" aria-hidden>•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
                {preferences.slice(0, 4).join(" · ")}
              </span>
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
    <Portal>
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
    </Portal>
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
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [adjustSource, setAdjustSource] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("La imagen no puede pesar más de 10 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) {
        setAvatarError("No se pudo leer la imagen.");
        return;
      }
      setAdjustSource(result);
    };
    reader.onerror = () => setAvatarError("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  }

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

  const bioMax = 300;
  const nameMax = 60;
  const hasCustomAvatar = avatarUrl.startsWith("data:");

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Editar perfil">
        <form onSubmit={submit} className="relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-surface/95 shadow-card backdrop-blur">
          {/* Banner decorativo */}
          <div className="relative h-24 overflow-hidden md:h-28">
            <div className="absolute inset-0 bg-gradient-to-br from-electric/35 via-violet/30 to-lime/20" />
            <div className="absolute -left-16 -top-12 h-44 w-44 rounded-full bg-electric/30 blur-3xl" />
            <div className="absolute -right-12 top-6 h-44 w-44 rounded-full bg-violet/25 blur-3xl" />
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

          <div className="relative max-h-[calc(90vh-7rem)] overflow-y-auto px-6 pb-6 pt-2 md:px-8 md:pb-7">
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-electric">Mi perfil</p>
              </div>
              <h2 className="text-2xl font-black md:text-3xl">Editar perfil</h2>
              <p className="mt-1.5 text-sm text-muted">El usuario <span className="text-foreground">@{profile.username}</span> no puede cambiarse en esta versión.</p>
            </div>

            <div className="space-y-6">
              {/* Avatar */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-electric" aria-hidden />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Avatar</p>
                </div>
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-electric via-violet to-lime opacity-70 blur-md" aria-hidden />
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/20 bg-gradient-to-br from-electric/40 to-violet/40 shadow-glow">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Vista previa del avatar" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-3xl font-black text-white">
                          {initials(displayName || profile.displayName)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                      <label className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-electric/30 bg-electric/10 px-3.5 py-2 text-sm font-semibold text-blue-100 transition hover:border-electric/60 hover:bg-electric/20">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                        {avatarUrl ? "Cambiar foto" : "Subir foto"}
                      </label>
                      {hasCustomAvatar && (
                        <button
                          type="button"
                          onClick={() => setAdjustSource(avatarUrl)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-muted transition hover:border-white/20 hover:bg-white/10 hover:text-foreground"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          Reajustar
                        </button>
                      )}
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => { setAvatarUrl(""); setAvatarError(null); }}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-muted transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Quitar
                        </button>
                      )}
                    </div>
                    <p className="text-center text-xs text-muted sm:text-left">PNG, JPG o WebP. Ajusta zoom y posición antes de guardar.</p>
                  </div>
                </div>
                {avatarError && (
                  <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{avatarError}</p>
                )}
                <details className="mt-3 text-xs text-muted">
                  <summary className="cursor-pointer select-none rounded-lg px-1 py-1 transition hover:text-foreground">o pega una URL en su lugar</summary>
                  <div className="mt-2">
                    <Input
                      value={hasCustomAvatar ? "" : avatarUrl}
                      maxLength={500}
                      onChange={(event) => setAvatarUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </details>
              </div>

              {/* Nombre */}
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-sm font-medium">Nombre visible</span>
                  <span className="text-[11px] tabular-nums text-muted">{displayName.length}/{nameMax}</span>
                </div>
                <Input value={displayName} maxLength={nameMax} onChange={(event) => setDisplayName(event.target.value)} />
              </div>

              {/* Bio */}
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-sm font-medium">Bio</span>
                  <span className="text-[11px] tabular-nums text-muted">{bio.length}/{bioMax}</span>
                </div>
                <textarea
                  value={bio}
                  maxLength={bioMax}
                  rows={4}
                  onChange={(event) => setBio(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted transition focus:border-electric focus:bg-white/[0.07]"
                  placeholder="Cuenta qué juegos te interesan..."
                />
              </div>

              <Picker title="Plataformas favoritas" eyebrow="Hardware" tone="electric" values={PLATFORM_OPTIONS} selected={favoritePlatforms} onToggle={(value) => toggle(favoritePlatforms, value, setFavoritePlatforms)} />
              <Picker title="Géneros favoritos" eyebrow="Gustos" tone="lime" values={GENRE_OPTIONS} selected={favoriteGenres} onToggle={(value) => toggle(favoriteGenres, value, setFavoriteGenres)} />
            </div>

            {error && <p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          </div>

          {/* Footer sticky */}
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 bg-surface/95 px-6 py-4 backdrop-blur md:px-8">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
      {adjustSource && (
        <AvatarAdjustDialog
          source={adjustSource}
          onClose={() => setAdjustSource(null)}
          onConfirm={(dataUrl) => {
            setAvatarUrl(dataUrl);
            setAdjustSource(null);
          }}
        />
      )}
    </Portal>
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

type PickerTone = "electric" | "lime";

function Picker({
  title,
  eyebrow,
  tone = "electric",
  values,
  selected,
  onToggle
}: {
  title: string;
  eyebrow?: string;
  tone?: PickerTone;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const toneClasses = {
    electric: {
      line: "bg-electric",
      eyebrow: "text-electric",
      active: "border-electric/60 bg-electric/15 text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.25)]"
    },
    lime: {
      line: "bg-lime",
      eyebrow: "text-lime",
      active: "border-lime/60 bg-lime/15 text-lime shadow-[0_0_20px_rgba(163,230,53,0.2)]"
    }
  }[tone];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          {eyebrow && (
            <div className="mb-1 flex items-center gap-2">
              <span className={`h-px w-4 rounded-full ${toneClasses.line}`} aria-hidden />
              <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${toneClasses.eyebrow}`}>{eyebrow}</p>
            </div>
          )}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className="text-[11px] tabular-nums text-muted">{selected.length} elegido{selected.length === 1 ? "" : "s"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              aria-pressed={active}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? toneClasses.active
                  : "border-white/10 bg-white/5 text-muted hover:border-white/25 hover:bg-white/10 hover:text-foreground"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toggle(list: string[], value: string, setter: (value: string[]) => void) {
  setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
}

function encodeCanvasToJpeg(canvas: HTMLCanvasElement, maxBytes = 450_000): string {
  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const approxBytes = Math.floor(((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 3) / 4);
    if (approxBytes <= maxBytes) return dataUrl;
  }
  throw new Error("La imagen es demasiado grande aunque comprimida. Prueba con otra más pequeña.");
}

function AvatarAdjustDialog({
  source,
  onClose,
  onConfirm
}: {
  source: string;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const previewSize = 288;
  const outputSize = 256;
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError("No se pudo cargar la imagen.");
    img.src = source;
  }, [source]);

  const baseScale = useMemo(() => {
    if (!image) return 1;
    return previewSize / Math.min(image.naturalWidth, image.naturalHeight);
  }, [image]);

  const renderedSize = useMemo(() => {
    if (!image) return { w: 0, h: 0 };
    return {
      w: image.naturalWidth * baseScale * zoom,
      h: image.naturalHeight * baseScale * zoom
    };
  }, [image, baseScale, zoom]);

  const clampOffset = (next: { x: number; y: number }) => {
    const maxX = Math.max(0, (renderedSize.w - previewSize) / 2);
    const maxY = Math.max(0, (renderedSize.h - previewSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y))
    };
  };

  useEffect(() => {
    const maxX = Math.max(0, (renderedSize.w - previewSize) / 2);
    const maxY = Math.max(0, (renderedSize.h - previewSize) / 2);
    setOffset((prev) => ({
      x: Math.max(-maxX, Math.min(maxX, prev.x)),
      y: Math.max(-maxY, Math.min(maxY, prev.y))
    }));
  }, [renderedSize.w, renderedSize.h]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(
      clampOffset({
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY)
      })
    );
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleConfirm() {
    if (!image) return;
    setError(null);

    const scale = baseScale * zoom;
    const sourceWindow = previewSize / scale;
    const sx = image.naturalWidth / 2 - sourceWindow / 2 - offset.x / scale;
    const sy = image.naturalHeight / 2 - sourceWindow / 2 - offset.y / scale;

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("No se pudo procesar la imagen en este navegador.");
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, sx, sy, sourceWindow, sourceWindow, 0, 0, outputSize, outputSize);

    try {
      const dataUrl = encodeCanvasToJpeg(canvas);
      onConfirm(dataUrl);
    } catch (encodeError) {
      setError(encodeError instanceof Error ? encodeError.message : "No se pudo procesar la imagen.");
    }
  }

  const zoomMin = 1;
  const zoomMax = 3;
  const zoomPercent = ((zoom - zoomMin) / (zoomMax - zoomMin)) * 100;
  const bumpZoom = (delta: number) =>
    setZoom((prev) => Math.min(zoomMax, Math.max(zoomMin, +(prev + delta).toFixed(2))));

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar avatar"
    >
      <div className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-surface/95 shadow-card backdrop-blur">
        {/* Banner */}
        <div className="relative h-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-electric/35 via-violet/30 to-lime/25" />
          <div className="absolute -left-12 -top-10 h-36 w-36 rounded-full bg-electric/35 blur-3xl" />
          <div className="absolute -right-10 -bottom-8 h-32 w-32 rounded-full bg-violet/30 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "28px 28px"
            }}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface/95 to-transparent" />
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

        <div className="px-6 pb-6 pt-2 md:px-7 md:pb-7">
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-electric">Avatar</p>
            </div>
            <h3 className="text-2xl font-black">Ajusta tu foto</h3>
            <p className="mt-1 text-xs text-muted">Arrastra para mover, usa el zoom para encuadrar.</p>
          </div>

          <div className="flex flex-col items-center gap-5">
            {/* Preview con doble vista: grande circular + miniatura "así te verán" */}
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-electric via-violet to-lime opacity-60 blur-md" aria-hidden />
              <div
                className="relative touch-none select-none overflow-hidden rounded-full border-2 border-white/20 bg-black/60 shadow-glow"
                style={{ width: previewSize, height: previewSize, cursor: image ? (dragRef.current ? "grabbing" : "grab") : "default" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
              >
                {image ? (
                  <img
                    src={source}
                    alt="Imagen a ajustar"
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: renderedSize.w,
                      height: renderedSize.h,
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                      maxWidth: "none",
                      pointerEvents: "none"
                    }}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center gap-2 p-4 text-center text-xs text-muted">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
                    Cargando imagen...
                  </div>
                )}
                {/* Cruz central */}
                {image && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-30">
                    <div className="h-6 w-px bg-white" />
                    <div className="absolute h-px w-6 bg-white" />
                  </div>
                )}
              </div>
              {/* Miniatura "así te verán" */}
              {image && (
                <div className="absolute -bottom-1 -right-1 flex items-center gap-2 rounded-full border border-white/15 bg-background/90 p-1 pr-3 shadow-card backdrop-blur">
                  <div
                    className="h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-black/40"
                  >
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${source})`,
                        backgroundSize: `${renderedSize.w / previewSize * 36}px ${renderedSize.h / previewSize * 36}px`,
                        backgroundPosition: `calc(50% + ${(offset.x / previewSize) * 36}px) calc(50% + ${(offset.y / previewSize) * 36}px)`
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Preview</span>
                </div>
              )}
            </div>

            {/* Slider de zoom con botones +/− */}
            <div className="w-full">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-muted">Zoom</span>
                <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono tabular-nums text-foreground">{zoom.toFixed(2)}×</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => bumpZoom(-0.1)}
                  disabled={zoom <= zoomMin}
                  aria-label="Reducir zoom"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-foreground transition hover:border-electric/40 hover:bg-electric/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14" /></svg>
                </button>
                <div className="relative flex-1">
                  <div
                    className="pointer-events-none absolute inset-y-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-electric to-violet"
                    style={{ width: `${zoomPercent}%` }}
                    aria-hidden
                  />
                  <div className="pointer-events-none absolute inset-y-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-white/10" aria-hidden />
                  <input
                    type="range"
                    min={zoomMin}
                    max={zoomMax}
                    step={0.01}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                    className="relative z-10 w-full appearance-none bg-transparent accent-electric"
                    aria-label="Zoom del avatar"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => bumpZoom(0.1)}
                  disabled={zoom >= zoomMax}
                  aria-label="Aumentar zoom"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-foreground transition hover:border-electric/40 hover:bg-electric/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
            </div>

            {error && (
              <p className="w-full rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-surface/95 px-6 py-4 backdrop-blur md:px-7">
          <button
            type="button"
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-muted transition hover:border-white/25 hover:text-foreground"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reiniciar
          </button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={handleConfirm} disabled={!image}>Aplicar</Button>
          </div>
        </div>
      </div>
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

function initials(value: string) {
  return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha no disponible";
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

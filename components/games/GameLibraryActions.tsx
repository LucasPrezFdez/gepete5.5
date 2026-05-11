"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Game, UserGameStatus } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import { useAuthSession } from "@/hooks/useAuthSession";

const actions: Array<{ status: UserGameStatus; label: string }> = [
  { status: "want_to_play", label: "Pendiente" },
  { status: "playing", label: "Jugando" },
  { status: "completed", label: "Completado" },
  { status: "favorite", label: "Favorito" }
];

export function GameLibraryActions({ game }: { game: Game }) {
  const { accessToken, isAuthenticated, isLoading } = useAuthSession();
  const [active, setActive] = useState<Set<UserGameStatus>>(new Set());
  const [loadingStatus, setLoadingStatus] = useState<UserGameStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatuses = useCallback(async (token: string) => {
    try {
      const response = await fetch(`/api/me/library?gameSlug=${encodeURIComponent(game.slug)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        setActive(new Set((payload?.statuses ?? []).map((item: any) => item.status)));
      }
    } catch {
      // Library status is progressive enhancement.
    }
  }, [game.slug]);

  useEffect(() => {
    if (accessToken) {
      void loadStatuses(accessToken);
    } else {
      setActive(new Set());
    }
  }, [accessToken, loadStatuses]);

  async function toggle(status: UserGameStatus) {
    setError(null);
    if (!accessToken) return;

    const enabled = !active.has(status);
    setLoadingStatus(status);
    try {
      const response = await fetch("/api/me/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ gameSlug: game.slug, status, enabled, game })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo actualizar la biblioteca.");
      setActive((value) => {
        const next = new Set(value);
        if (enabled) next.add(status);
        else next.delete(status);
        return next;
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo actualizar la biblioteca.");
    } finally {
      setLoadingStatus(null);
    }
  }

  const activeLabels = useMemo(
    () => actions.filter((action) => active.has(action.status)).map((action) => action.label),
    [active]
  );

  if (isLoading) {
    return (
      <div className="h-11 w-48 animate-pulse rounded-xl bg-white/10" aria-hidden="true" />
    );
  }

  if (!isAuthenticated) {
    return (
      <SignInPrompt
        variant="inline"
        title="Inicia sesión para guardar este juego en tu biblioteca"
        description="Marca como pendiente, jugando, completado o favorito."
        redirectTo={`/games/${game.slug}`}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            variant={active.has(action.status) ? "primary" : "secondary"}
            onClick={() => toggle(action.status)}
            disabled={loadingStatus === action.status}
            aria-pressed={active.has(action.status)}
          >
            {loadingStatus === action.status ? "Guardando..." : action.label}
          </Button>
        ))}
      </div>
      {activeLabels.length > 0 && <p className="text-xs text-muted">En tu biblioteca: {activeLabels.join(", ")}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

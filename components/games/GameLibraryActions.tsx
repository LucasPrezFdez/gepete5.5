"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthSession } from "@/services/auth-types";
import type { Game, UserGameStatus } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { createBrowserAuthClient } from "@/services/auth-browser";

const actions: Array<{ status: UserGameStatus; label: string }> = [
  { status: "want_to_play", label: "Pendiente" },
  { status: "playing", label: "Jugando" },
  { status: "completed", label: "Completado" },
  { status: "favorite", label: "Favorito" }
];

export function GameLibraryActions({ game }: { game: Game }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [active, setActive] = useState<Set<UserGameStatus>>(new Set());
  const [loadingStatus, setLoadingStatus] = useState<UserGameStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatuses = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch(`/api/me/library?gameSlug=${encodeURIComponent(game.slug)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
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
    let mounted = true;
    let authClient: ReturnType<typeof createBrowserAuthClient>;
    try {
      authClient = createBrowserAuthClient();
    } catch {
      return () => {
        mounted = false;
      };
    }

    authClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.access_token) void loadStatuses(data.session.access_token);
    });

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) void loadStatuses(nextSession.access_token);
      else setActive(new Set());
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadStatuses]);

  async function toggle(status: UserGameStatus) {
    setError(null);
    if (!session?.access_token) {
      setError("Inicia sesión para guardar juegos en tu biblioteca.");
      return;
    }

    const enabled = !active.has(status);
    setLoadingStatus(status);
    try {
      const response = await fetch("/api/me/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
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



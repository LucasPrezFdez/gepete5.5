"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "@/services/auth-types";
import type { Game } from "@/data/games";
import { createBrowserAuthClient } from "@/services/auth-browser";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { CommunityRatingForm } from "@/components/ratings/CommunityRatingForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { formatCompactNumber } from "@/lib/utils";

type CommunityComment = {
  id: string;
  score: number;
  body: string;
  updatedAt: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type CommunityPayload = {
  averageScore: number;
  ratingCount: number;
  userRating: {
    score: number;
    comment: string;
  } | null;
  comments: CommunityComment[];
};

export function GameCommunity({ game }: { game: Game }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [payload, setPayload] = useState<CommunityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunity = useCallback(async (accessToken?: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${encodeURIComponent(game.slug)}/community`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store"
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudieron cargar los comentarios.");
      }

      setPayload(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "No se pudieron cargar los comentarios.");
    } finally {
      setLoading(false);
    }
  }, [game.slug]);

  useEffect(() => {
    let mounted = true;
    let authClient: ReturnType<typeof createBrowserAuthClient>;

    try {
      authClient = createBrowserAuthClient();
    } catch {
      fetchCommunity(null);
      return () => {
        mounted = false;
      };
    }

    authClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      fetchCommunity(data.session?.access_token);
    });

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      fetchCommunity(nextSession?.access_token);
    });

    const handleCommunityUpdated = () => {
      authClient.auth.getSession().then(({ data }) => fetchCommunity(data.session?.access_token));
    };

    window.addEventListener("game-community-updated", handleCommunityUpdated);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("game-community-updated", handleCommunityUpdated);
    };
  }, [fetchCommunity]);

  const averageScore = payload?.averageScore ?? game.userScore;
  const ratingCount = payload?.ratingCount ?? game.ratings;
  const comments = payload?.comments ?? [];

  return (
    <section id="community-rating" className="container-page py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">
            Comunidad
          </p>
          <h2 className="text-2xl font-black md:text-3xl">Comentarios de la comunidad</h2>
        </div>
        <div className="flex items-center gap-3">
          <RatingBadge score={averageScore} label="Usuarios" />
          <span className="text-sm text-muted">
            {formatCompactNumber(ratingCount)} valoraciones
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-xl font-bold">
              {payload?.userRating ? "Edita tu valoración" : "Tu valoración"}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Publica una nota y un comentario corto para este juego.
            </p>
          </CardHeader>
          <CardContent>
            <CommunityRatingForm
              game={game}
              initialScore={payload?.userRating?.score}
              initialComment={payload?.userRating?.comment}
              compact
              onSaved={() => fetchCommunity(session?.access_token)}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {error && <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">{error}</div>}
          {loading && <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">Cargando comentarios...</div>}
          {!loading && !error && comments.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">
              Todavía no hay comentarios. Sé la primera persona en valorar este juego.
            </div>
          )}
          {comments.map((comment) => (
            <article key={comment.id} className="surface-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted">
                    por @{comment.user.username} · {formatDate(comment.updatedAt)}
                  </p>
                  <h3 className="mt-1 text-lg font-bold">{comment.user.displayName}</h3>
                </div>
                <RatingBadge score={comment.score} compact />
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">{comment.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "fecha no disponible";
  }

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}




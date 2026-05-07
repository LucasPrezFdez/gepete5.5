"use client";

import { useState } from "react";
import type { Review } from "@/data/games";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RatingBadge } from "@/components/ratings/RatingBadge";

export type ReviewCardProps = Review | {
  user: string;
  title: string;
  body: string;
  score: number;
  helpful: number;
  hasSpoilers?: boolean;
};

export function ReviewCard(props: ReviewCardProps) {
  const review = normalizeReview(props);
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function voteHelpful() {
    if (!review.id) return;
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Inicia sesión para votar reseñas útiles.");
      const response = await fetch(`/api/reviews/${review.id}/helpful`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo registrar el voto.");
      setHelpfulCount(Number(payload.helpfulCount ?? helpfulCount + 1));
      setVoted(true);
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "No se pudo registrar el voto.");
    }
  }

  return (
    <article className="surface-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">por @{review.username}</p>
          <h3 className="mt-1 text-lg font-bold">{review.title}</h3>
          {review.gameTitle && <p className="mt-1 text-xs text-muted">{review.gameTitle}</p>}
        </div>
        <RatingBadge score={review.score} compact />
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">{review.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        {review.hasSpoilers && <Badge tone="danger">Spoilers</Badge>}
        <Button type="button" size="sm" variant={voted ? "secondary" : "ghost"} onClick={voteHelpful} disabled={!review.id || voted}>
          {helpfulCount} votos útiles
        </Button>
        {error && <span className="text-danger">{error}</span>}
      </div>
    </article>
  );
}

function normalizeReview(props: ReviewCardProps) {
  if ("helpfulCount" in props) {
    return {
      id: props.id,
      username: props.user.username,
      title: props.title,
      body: props.body,
      score: props.score,
      helpfulCount: props.helpfulCount,
      hasSpoilers: props.hasSpoilers,
      gameTitle: props.gameTitle
    };
  }

  return {
    id: "",
    username: props.user,
    title: props.title,
    body: props.body,
    score: props.score,
    helpfulCount: props.helpful,
    hasSpoilers: Boolean(props.hasSpoilers),
    gameTitle: undefined
  };
}

async function getAccessToken() {
  const { createBrowserAuthClient } = await import("@/services/auth-browser");
  try {
    const authClient = createBrowserAuthClient();
    const { data } = await authClient.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}



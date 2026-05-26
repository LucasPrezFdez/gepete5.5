"use client";

import Link from "next/link";
import { useState } from "react";
import type { Review } from "@/data/games";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { ReportButton } from "@/components/feedback/ReportButton";
import { buildAuthRedirectUrl, useAuthSession } from "@/hooks/useAuthSession";
import { plainTextToReviewHtml, sanitizeReviewHtml } from "@/lib/sanitize-review";

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
  const { accessToken, isAuthenticated, isLoading } = useAuthSession();
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canVote = Boolean(review.id) && isAuthenticated && !voted;
  const redirectTo = review.gameSlug ? `/games/${review.gameSlug}` : "/";

  async function voteHelpful() {
    if (!review.id || !accessToken) return;
    setError(null);
    try {
      const response = await fetch(`/api/reviews/${review.id}/helpful`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo registrar el voto.");
      setHelpfulCount(Number(payload.helpfulCount ?? helpfulCount + 1));
      setVoted(true);
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "No se pudo registrar el voto.");
    }
  }

  const gameHref = review.gameSlug
    ? review.id
      ? `/games/${review.gameSlug}/reviews#review-${review.id}`
      : `/games/${review.gameSlug}`
    : null;
  const showSeparateTitle = review.title && review.title.trim() !== (review.gameTitle ?? "").trim();

  return (
    <article id={review.id ? `review-${review.id}` : undefined} className="surface-card rounded-2xl p-5 scroll-mt-24">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {review.gameTitle ? (
            gameHref ? (
              <Link
                href={gameHref}
                className="inline-flex items-center gap-1.5 text-base font-bold text-foreground transition hover:text-electric"
              >
                <span className="truncate">{review.gameTitle}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 opacity-70">
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </Link>
            ) : (
              <p className="text-base font-bold">{review.gameTitle}</p>
            )
          ) : null}
          <p className="mt-1 text-xs text-muted">por @{review.username}</p>
          {showSeparateTitle && <h3 className="mt-2 text-sm font-semibold text-foreground/90">{review.title}</h3>}
        </div>
        <RatingBadge score={review.score} compact />
      </div>
      <div
        className="prose-review mt-4 text-sm leading-6 text-muted"
        dangerouslySetInnerHTML={{ __html: renderReviewBody(review.body) }}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        {review.hasSpoilers && <Badge tone="danger">Spoilers</Badge>}
        {review.id ? (
          isLoading ? (
            <span className="rounded-xl border border-white/10 px-3 py-1.5">{helpfulCount} votos útiles</span>
          ) : isAuthenticated ? (
            <Button
              type="button"
              size="sm"
              variant={voted ? "secondary" : "ghost"}
              onClick={voteHelpful}
              disabled={!canVote}
              aria-pressed={voted}
            >
              {helpfulCount} votos útiles
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              asChild
              href={buildAuthRedirectUrl(redirectTo, "signin")}
              title="Inicia sesión para votar"
            >
              {helpfulCount} votos útiles
            </Button>
          )
        ) : (
          <span className="rounded-xl border border-white/10 px-3 py-1.5">{helpfulCount} votos útiles</span>
        )}
        {error && <span className="text-danger">{error}</span>}
        {review.id && (
          <ReportButton
            targetType="review"
            targetId={review.id}
            authorId={review.userId}
            className="ml-auto"
          />
        )}
      </div>
    </article>
  );
}

function normalizeReview(props: ReviewCardProps) {
  if ("helpfulCount" in props) {
    return {
      id: props.id,
      userId: props.user.id,
      username: props.user.username,
      title: props.title,
      body: props.body,
      score: props.score,
      helpfulCount: props.helpfulCount,
      hasSpoilers: props.hasSpoilers,
      gameTitle: props.gameTitle,
      gameSlug: props.gameSlug
    };
  }

  return {
    id: "",
    userId: null as string | null,
    username: props.user,
    title: props.title,
    body: props.body,
    score: props.score,
    helpfulCount: props.helpful,
    hasSpoilers: Boolean(props.hasSpoilers),
    gameTitle: undefined,
    gameSlug: undefined as string | undefined
  };
}

function renderReviewBody(body: string | null | undefined): string {
  if (!body) return "";
  const trimmed = body.trim();
  const looksLikeHtml = /^<(p|h3|ul|ol|blockquote|strong|em|s|u|code|br)\b/i.test(trimmed);
  return sanitizeReviewHtml(looksLikeHtml ? trimmed : plainTextToReviewHtml(trimmed));
}

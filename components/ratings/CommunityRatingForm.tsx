"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Game } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import { useAuthSession } from "@/hooks/useAuthSession";

type CommunityRatingFormProps = {
  game: Game;
  initialScore?: number;
  initialComment?: string;
  compact?: boolean;
  onSaved?: () => void;
};

const MAX_COMMENT_LENGTH = 1000;

export function CommunityRatingForm({
  game,
  initialScore,
  initialComment,
  compact,
  onSaved
}: CommunityRatingFormProps) {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuthSession();
  const [score, setScore] = useState(initialScore ?? 8);
  const [comment, setComment] = useState(initialComment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initialScore) {
      setScore(initialScore);
    }
  }, [initialScore]);

  useEffect(() => {
    if (typeof initialComment === "string") {
      setComment(initialComment);
    }
  }, [initialComment]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanComment = comment.trim();

    if (!accessToken) {
      setError("Debes iniciar sesión para guardar tu valoración.");
      return;
    }

    if (cleanComment.length < 3 || cleanComment.length > MAX_COMMENT_LENGTH) {
      setError(`El comentario debe tener entre 3 y ${MAX_COMMENT_LENGTH} caracteres.`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/games/${encodeURIComponent(game.slug)}/community`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          score,
          comment: cleanComment,
          game: {
            title: game.title,
            summary: game.summary,
            releaseYear: game.year,
            status: game.status,
            coverUrl: game.coverUrl,
            heroUrl: game.heroUrl
          }
        })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar la valoración.");
      }

      setComment(cleanComment);
      setSuccess("Valoración guardada.");
      window.dispatchEvent(new CustomEvent("game-community-updated"));
      onSaved?.();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar la valoración.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">
        Cargando sesión...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <SignInPrompt
        title="Inicia sesión para valorar"
        description="Necesitas una cuenta para publicar tu puntuación y comentario."
        redirectTo={`/games/${game.slug}`}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? "space-y-4" : "rounded-2xl border border-white/10 bg-white/5 p-5"}
    >
      <div>
        <label className="block text-sm font-medium" htmlFor={`score-${game.slug}`}>
          Puntuación: <span className="font-black text-electric">{score}/10</span>
        </label>
        <input
          id={`score-${game.slug}`}
          type="range"
          min="1"
          max="10"
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          className="mt-3 w-full accent-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor={`comment-${game.slug}`}>
          Comentario
        </label>
        <textarea
          id={`comment-${game.slug}`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={compact ? 4 : 5}
          placeholder="Cuenta qué te ha parecido el juego..."
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted transition focus:border-electric focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-muted">
          {comment.trim().length}/{MAX_COMMENT_LENGTH}
        </p>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {success && <p className="rounded-xl bg-lime/10 p-3 text-sm text-lime">{success}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Guardando..." : "Guardar valoración"}
      </Button>
    </form>
  );
}

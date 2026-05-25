"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import { useAuthSession } from "@/hooks/useAuthSession";
import { cn } from "@/lib/utils";

type CommunityRatingFormProps = {
  game: Game;
  initialScore?: number;
  initialComment?: string;
  compact?: boolean;
  onSaved?: () => void;
};

const MAX_COMMENT_LENGTH = 1000;
const MIN_COMMENT_LENGTH = 3;
const SCORE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type ScoreTone = {
  label: string;
  description: string;
  accent: string;
  badge: string;
  trackColor: string;
};

function getScoreTone(score: number): ScoreTone {
  if (score <= 3) {
    return {
      label: "Decepcionante",
      description: "No te ha convencido en absoluto.",
      accent: "from-danger/40 via-danger/15 to-transparent",
      badge: "border-danger/40 bg-danger/15 text-danger",
      trackColor: "#F43F5E"
    };
  }
  if (score <= 5) {
    return {
      label: "Mejorable",
      description: "Tiene aciertos, pero también claros desaciertos.",
      accent: "from-amber-500/40 via-amber-500/15 to-transparent",
      badge: "border-amber-400/40 bg-amber-400/15 text-amber-300",
      trackColor: "#F59E0B"
    };
  }
  if (score <= 7) {
    return {
      label: "Notable",
      description: "Un buen juego que recomendarías con matices.",
      accent: "from-electric/40 via-electric/15 to-transparent",
      badge: "border-electric/40 bg-electric/15 text-electric",
      trackColor: "#3B82F6"
    };
  }
  if (score <= 9) {
    return {
      label: "Sobresaliente",
      description: "Un imprescindible de su género.",
      accent: "from-violet/45 via-violet/15 to-transparent",
      badge: "border-violet/40 bg-violet/15 text-violet-200",
      trackColor: "#8B5CF6"
    };
  }
  return {
    label: "Obra maestra",
    description: "Una experiencia inolvidable.",
    accent: "from-violet/50 via-electric/25 to-transparent",
    badge: "border-violet/50 bg-gradient-to-r from-violet/25 to-electric/25 text-foreground",
    trackColor: "#A78BFA"
  };
}

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

  const tone = useMemo(() => getScoreTone(score), [score]);
  const commentLength = comment.trim().length;
  const commentValid = commentLength >= MIN_COMMENT_LENGTH && commentLength <= MAX_COMMENT_LENGTH;
  const counterTone =
    commentLength === 0
      ? "text-muted"
      : commentLength < MIN_COMMENT_LENGTH
        ? "text-amber-300"
        : commentLength > MAX_COMMENT_LENGTH - 50
          ? "text-amber-300"
          : "text-muted";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanComment = comment.trim();

    if (!accessToken) {
      setError("Debes iniciar sesión para guardar tu valoración.");
      return;
    }

    if (cleanComment.length < MIN_COMMENT_LENGTH || cleanComment.length > MAX_COMMENT_LENGTH) {
      setError(`El comentario debe tener entre ${MIN_COMMENT_LENGTH} y ${MAX_COMMENT_LENGTH} caracteres.`);
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

  const sliderPercent = ((score - 1) / 9) * 100;

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? "space-y-6"
          : "space-y-6 rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-card backdrop-blur"
      }
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-5 transition-colors",
          tone.accent
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">Puntuación</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-5xl font-black leading-none tabular-nums text-foreground">
                {score}
              </span>
              <span className="text-base font-bold text-muted">/ 10</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{tone.label}</p>
            <p className="text-xs text-muted">{tone.description}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
              tone.badge
            )}
          >
            {tone.label}
          </span>
        </div>

        <div className="mt-5">
          <input
            id={`score-${game.slug}`}
            aria-label="Puntuación de 1 a 10"
            type="range"
            min={1}
            max={10}
            step={1}
            value={score}
            onChange={(event) => setScore(Number(event.target.value))}
            className="rating-slider h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, ${tone.trackColor} 0%, ${tone.trackColor} ${sliderPercent}%, rgba(255,255,255,0.08) ${sliderPercent}%, rgba(255,255,255,0.08) 100%)`
            }}
          />
          <div className="mt-3 grid grid-cols-10 gap-1">
            {SCORE_STEPS.map((value) => {
              const active = value === score;
              const reached = value <= score;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScore(value)}
                  aria-label={`Puntuar con ${value}`}
                  aria-pressed={active}
                  className={cn(
                    "group relative h-9 rounded-lg border text-xs font-bold transition-all duration-150",
                    active
                      ? "border-white/30 bg-white/10 text-foreground shadow-[0_4px_14px_-4px_rgba(255,255,255,0.25)]"
                      : reached
                        ? "border-white/10 bg-white/[0.06] text-foreground hover:border-white/20"
                        : "border-white/5 bg-white/[0.02] text-muted hover:border-white/15 hover:text-foreground"
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground" htmlFor={`comment-${game.slug}`}>
            Tu reseña
          </label>
          <span className={cn("font-mono text-xs tabular-nums", counterTone)}>
            {commentLength}/{MAX_COMMENT_LENGTH}
          </span>
        </div>
        <div className="relative">
          <textarea
            id={`comment-${game.slug}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={MAX_COMMENT_LENGTH}
            rows={compact ? 5 : 6}
            placeholder="Cuenta qué te ha parecido el juego, qué destacarías y qué le falta..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted transition focus:border-electric/60 focus:bg-background/80 focus:outline-none focus:ring-2 focus:ring-electric/20"
          />
        </div>
        {commentLength > 0 && commentLength < MIN_COMMENT_LENGTH && (
          <p className="mt-1.5 text-xs text-amber-300">
            Escribe al menos {MIN_COMMENT_LENGTH} caracteres.
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-lime/30 bg-lime/10 px-3 py-2.5 text-sm text-lime">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      <div
        className={cn(
          "flex flex-wrap items-center gap-3",
          compact ? "justify-between" : "justify-end"
        )}
      >
        {compact && (
          <p className="text-xs text-muted">
            Tu valoración será pública en tu perfil.
          </p>
        )}
        <div className="flex items-center gap-2">
          {compact && onSaved && (
            <Button type="button" variant="ghost" onClick={onSaved} disabled={submitting}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={submitting || !commentValid} className="gap-2">
            {submitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                Guardando
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Guardar valoración
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

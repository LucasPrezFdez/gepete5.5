"use client";

import { useState } from "react";
import type { Game } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import { RichReviewEditor } from "@/components/reviews/RichReviewEditor";
import { useAuthSession } from "@/hooks/useAuthSession";

export function ReviewForm({ game, onSaved, onCancel }: { game: Game; onSaved?: () => void; onCancel?: () => void }) {
  const { accessToken, isAuthenticated, isLoading } = useAuthSession();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bodyTextLength, setBodyTextLength] = useState(0);
  const [score, setScore] = useState(8);
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const titleMax = 160;
  const bodyMax = 8000;
  const bodyMin = 20;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!accessToken) {
      setError("Inicia sesión para publicar una reseña.");
      return;
    }
    if (bodyTextLength < bodyMin) {
      setError(`La reseña debe tener al menos ${bodyMin} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ gameSlug: game.slug, game, title, body, score, hasSpoilers })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo publicar la reseña.");
      setTitle("");
      setBody("");
      setBodyTextLength(0);
      setHasSpoilers(false);
      setSuccess("Reseña publicada.");
      onSaved?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo publicar la reseña.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-muted">
        Cargando sesión...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <SignInPrompt
        title="Inicia sesión para escribir una reseña"
        description={`Necesitas una cuenta para publicar una reseña larga de ${game.title}.`}
        redirectTo={`/games/${game.slug}/reviews`}
      />
    );
  }

  const bodyLength = bodyTextLength;
  const remainingForMin = Math.max(0, bodyMin - bodyLength);
  const scoreTone =
    score >= 9 ? "text-lime" : score >= 7 ? "text-electric" : score >= 5 ? "text-amber-400" : "text-danger";
  const scoreLabel =
    score >= 9 ? "Imprescindible" : score >= 7 ? "Recomendable" : score >= 5 ? "Correcto" : score >= 3 ? "Flojo" : "Decepcionante";
  const sliderPercent = ((score - 1) / 9) * 100;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-end justify-between">
              <label htmlFor="review-title" className="text-sm font-semibold text-foreground">Título</label>
              <span className="text-[11px] tabular-nums text-muted">{title.length}/{titleMax}</span>
            </div>
            <Input
              id="review-title"
              value={title}
              maxLength={titleMax}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              required
              placeholder={`Tu veredicto sobre ${game.title}`}
            />
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between">
              <label htmlFor="review-body" className="text-sm font-semibold text-foreground">Reseña</label>
              <span className="text-[11px] tabular-nums text-muted">{bodyLength}/{bodyMax}</span>
            </div>
            <RichReviewEditor
              value={body}
              onChange={setBody}
              onTextLength={setBodyTextLength}
              placeholder={`Cuenta cómo te ha tratado ${game.title}. Qué funciona, qué no, a quién se la recomendarías... Desarrolla tu opinión con calma.`}
            />
            <p className="mt-2 text-xs text-muted">
              {remainingForMin > 0
                ? `Faltan ${remainingForMin} caracteres para alcanzar el mínimo.`
                : "Listo para publicar cuando quieras."}
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tu nota</span>
              <span className={`text-[11px] font-semibold ${scoreTone}`}>{scoreLabel}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={`text-5xl font-black leading-none tabular-nums ${scoreTone}`}>{score}</span>
              <span className="text-sm font-medium text-muted">/10</span>
            </div>
            <div className="relative mt-5">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" aria-hidden />
              <div
                className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-electric to-violet"
                style={{ width: `${sliderPercent}%` }}
                aria-hidden
              />
              <input
                id="review-score"
                type="range"
                min="1"
                max="10"
                step="1"
                value={score}
                onChange={(event) => setScore(Number(event.target.value))}
                className="relative z-10 block w-full appearance-none bg-transparent accent-electric"
                aria-label="Puntuación del juego"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm transition hover:border-white/20">
            <input
              type="checkbox"
              checked={hasSpoilers}
              onChange={(event) => setHasSpoilers(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-danger"
            />
            <span>
              <span className="block font-semibold text-foreground">Contiene spoilers</span>
              <span className="block text-xs text-muted">Se ocultará por defecto a quien no quiera verla.</span>
            </span>
          </label>
        </aside>
      </div>

      {error && <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {success && <p className="rounded-xl border border-lime/30 bg-lime/10 p-3 text-sm text-lime">{success}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-5">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Publicando..." : "Publicar reseña"}
        </Button>
      </div>
    </form>
  );
}

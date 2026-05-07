"use client";

import { useEffect, useState } from "react";
import type { AuthSession } from "@/services/auth-types";
import type { Game } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBrowserAuthClient } from "@/services/auth-browser";

export function ReviewForm({ game, onSaved }: { game: Game; onSaved?: () => void }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [score, setScore] = useState(8);
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      if (mounted) setSession(data.session);
    });
    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!session?.access_token) {
      setError("Inicia sesión para publicar una reseña.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ gameSlug: game.slug, game, title, body, score, hasSpoilers })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo publicar la reseña.");
      setTitle("");
      setBody("");
      setHasSpoilers(false);
      setSuccess("Reseña publicada.");
      onSaved?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo publicar la reseña.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">
        Inicia sesión para escribir una reseña larga de {game.title}.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface-card space-y-4 rounded-2xl p-5">
      <div>
        <label htmlFor="review-title" className="mb-2 block text-sm font-medium">Título</label>
        <Input id="review-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} required />
      </div>
      <div>
        <label htmlFor="review-score" className="block text-sm font-medium">Puntuación: <span className="text-electric">{score}/10</span></label>
        <input id="review-score" type="range" min="1" max="10" value={score} onChange={(event) => setScore(Number(event.target.value))} className="mt-3 w-full accent-blue-500" />
      </div>
      <div>
        <label htmlFor="review-body" className="mb-2 block text-sm font-medium">Reseña</label>
        <textarea
          id="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={7}
          minLength={20}
          maxLength={8000}
          required
          className="w-full resize-y rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted transition focus:border-electric focus:outline-none"
          placeholder="Desarrolla tu opinión, qué funciona, qué no y a quién se lo recomendarías..."
        />
        <p className="mt-1 text-right text-xs text-muted">{body.trim().length}/8000</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={hasSpoilers} onChange={(event) => setHasSpoilers(event.target.checked)} />
        Contiene spoilers
      </label>
      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {success && <p className="rounded-xl bg-lime/10 p-3 text-sm text-lime">{success}</p>}
      <Button type="submit" disabled={submitting}>{submitting ? "Publicando..." : "Publicar reseña"}</Button>
    </form>
  );
}



"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuthSession } from "@/hooks/useAuthSession";

type Recommendation = {
  slug: string;
  title: string;
  coverUrl: string | null;
  reason: string;
  affinity: number | null;
  year: number | null;
  genres: string[];
};

type ApiResponse = {
  recommendations: Recommendation[];
  source: "cache" | "fresh" | "empty";
  generatedAt: string | null;
  expiresAt: string | null;
  emptyReason?: "no-library" | "no-candidates" | "llm-unavailable";
};

type Status = "idle" | "loading" | "refreshing" | "ready" | "empty" | "error";

const EMPTY_MESSAGES: Record<NonNullable<ApiResponse["emptyReason"]>, string> = {
  "no-library":
    "Añade juegos a tu biblioteca o puntúa algunos títulos para que la IA pueda recomendarte algo personalizado.",
  "no-candidates":
    "No hemos encontrado candidatos nuevos para tu perfil. Vuelve a intentarlo más tarde o amplía tus géneros favoritos.",
  "llm-unavailable":
    "El servicio de recomendaciones IA no está disponible ahora mismo. Inténtalo de nuevo en unos minutos."
};

export function RecommendationsForYou() {
  const { isAuthenticated, accessToken, isLoading: authLoading } = useAuthSession();
  const [status, setStatus] = useState<Status>("idle");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [meta, setMeta] = useState<{ source: ApiResponse["source"]; emptyReason?: ApiResponse["emptyReason"] }>({
    source: "empty"
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      if (!accessToken) return;
      setStatus(force ? "refreshing" : "loading");
      setErrorMessage(null);
      try {
        const response = await fetch("/api/me/recommendations", {
          method: force ? "POST" : "GET",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = (await response.json().catch(() => null)) as
          | (ApiResponse & { error?: string })
          | null;

        if (!response.ok || !data) {
          setStatus("error");
          setErrorMessage(data?.error ?? "No se pudieron cargar las recomendaciones.");
          return;
        }

        setRecommendations(data.recommendations);
        setMeta({ source: data.source, emptyReason: data.emptyReason });
        setStatus(data.recommendations.length > 0 ? "ready" : "empty");
      } catch {
        setStatus("error");
        setErrorMessage("Error de red al cargar las recomendaciones.");
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !accessToken) {
      setStatus("idle");
      setRecommendations([]);
      return;
    }
    load(false);
  }, [accessToken, authLoading, isAuthenticated, load]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <section className="container-page my-12">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6 backdrop-blur md:p-8">
        <Header
          status={status}
          source={meta.source}
          onRefresh={() => load(true)}
        />

        <div className="mt-6">
          {status === "loading" ? (
            <SkeletonRow />
          ) : status === "error" ? (
            <ErrorState message={errorMessage} onRetry={() => load(false)} />
          ) : status === "empty" ? (
            <EmptyState reason={meta.emptyReason} />
          ) : recommendations.length > 0 ? (
            <RecommendationGrid items={recommendations} dimmed={status === "refreshing"} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Header({
  status,
  source,
  onRefresh
}: {
  status: Status;
  source: ApiResponse["source"];
  onRefresh: () => void;
}) {
  const refreshing = status === "refreshing";
  const cached = source === "cache" && status === "ready";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-electric">Para ti</p>
        <h2 className="mt-2 text-3xl font-black md:text-4xl">Recomendado por IA</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Selección personalizada según tu biblioteca, puntuaciones y géneros favoritos. Cada frase la genera un
          modelo a partir de tus juegos.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-electric" />
          Generado por IA
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || status === "loading"}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Generando…" : cached ? "Refrescar" : "Volver a generar"}
        </button>
      </div>
    </div>
  );
}

function RecommendationGrid({ items, dimmed }: { items: Recommendation[]; dimmed: boolean }) {
  return (
    <div
      className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-5 ${
        dimmed ? "opacity-60" : "opacity-100"
      }`}
    >
      {items.map((item, index) => (
        <RecommendationCard key={item.slug} item={item} priority={index < 2} />
      ))}
    </div>
  );
}

function RecommendationCard({ item, priority }: { item: Recommendation; priority: boolean }) {
  return (
    <Link
      href={`/games/${encodeURIComponent(item.slug)}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:-translate-y-0.5 hover:border-white/30 hover:shadow-lg"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
        {item.coverUrl ? (
          <Image
            src={item.coverUrl}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">Sin portada</div>
        )}
        {item.affinity !== null && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-electric backdrop-blur">
            {item.affinity}% afinidad
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-bold">{item.title}</h3>
          {item.year ? <span className="text-[11px] text-white/50">{item.year}</span> : null}
        </div>
        <p
          className="line-clamp-3 text-xs leading-relaxed text-white/70"
          dangerouslySetInnerHTML={{ __html: formatReason(item.reason) }}
        />
        {item.genres.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {item.genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonRow() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
        >
          <div className="aspect-[3/4] animate-pulse bg-white/10" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="h-2 w-full animate-pulse rounded bg-white/10" />
            <div className="h-2 w-5/6 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ reason }: { reason?: ApiResponse["emptyReason"] }) {
  const message = reason ? EMPTY_MESSAGES[reason] : EMPTY_MESSAGES["no-library"];
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center">
      <p className="text-sm text-white/70">{message}</p>
      <Link
        href="/games"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-electric px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:opacity-90"
      >
        Explorar catálogo
      </Link>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
      <p className="text-sm text-rose-100">{message ?? "Algo ha fallado."}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white/20"
      >
        Reintentar
      </button>
    </div>
  );
}

function formatReason(reason: string) {
  const escaped = reason
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>');
}

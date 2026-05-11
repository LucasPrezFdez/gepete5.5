"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Game } from "@/data/games";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export function GameSearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search/games?q=${encodeURIComponent(normalizedQuery)}&pageSize=5`, {
          signal: controller.signal
        });
        const payload = await response.json();
        setResults(Array.isArray(payload.games) ? payload.games : []);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [normalizedQuery]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(normalizedQuery ? `/games?q=${encodeURIComponent(normalizedQuery)}` : "/games");
  }

  return (
    <form className="relative" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={compact ? "global-search" : "hero-search"}>
        Buscar videojuegos, estudios, sagas o creadores
      </label>
      <Input
        id={compact ? "global-search" : "hero-search"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Busca videojuegos, estudios, sagas o creadores"
        className={cn(!compact && "h-14 rounded-2xl text-base")}
      />
      {(results.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-white/[0.08] bg-elevated shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {loading && results.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3.5 text-sm text-muted">
              <svg className="animate-spin text-electric/60" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Buscando en el catálogo...
            </div>
          )}
          {results.map((game) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-100 hover:bg-white/[0.07]"
              onClick={() => setQuery("")}
            >
              {game.coverUrl && (
                <span className="relative block h-11 w-8 flex-shrink-0 overflow-hidden rounded-md bg-white/5">
                  <Image src={game.coverUrl} alt="" fill sizes="32px" className="object-cover" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{game.title}</span>
                <span className="block truncate text-xs text-muted/70">
                  {game.year || "TBA"}{game.developer ? ` · ${game.developer}` : ""}
                </span>
              </span>
              {game.userScore > 0 && (
                <span className="shrink-0 text-xs font-bold tabular-nums text-electric/80">
                  {game.userScore.toFixed(1)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </form>
  );
}



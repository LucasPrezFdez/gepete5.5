"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
        const response = await fetch(`/api/search/games??q=${encodeURIComponent(normalizedQuery)}&pageSize=5`, {
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
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-elevated shadow-card">
          {loading && results.length === 0 && <div className="px-4 py-3 text-sm text-muted">Buscando en el catálogo...</div>}
          {results.map((game) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/10"
              onClick={() => setQuery("")}
            >
              <span>
                <strong>{game.title}</strong>
                <span className="ml-2 text-muted">{game.year || "TBA"}</span>
              </span>
              <span className="text-xs text-muted">{game.developer}</span>
            </Link>
          ))}
        </div>
      )}
    </form>
  );
}



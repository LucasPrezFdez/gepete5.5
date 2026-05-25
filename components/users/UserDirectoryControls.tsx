"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { DirectorySort } from "@/services/users";

const SORT_OPTIONS: Array<{ value: DirectorySort; label: string }> = [
  { value: "followers", label: "Más seguidos" },
  { value: "ratings", label: "Más valoraciones" },
  { value: "completed", label: "Más completados" },
  { value: "alphabetical", label: "Alfabético" }
];

export function UserDirectoryControls({
  initialQuery,
  initialSort,
  totalCount
}: {
  initialQuery: string;
  initialSort: DirectorySort;
  totalCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<DirectorySort>(initialSort);
  const [isPending, startTransition] = useTransition();

  const navigate = (nextQuery: string, nextSort: DirectorySort) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextSort !== "followers") params.set("sort", nextSort);
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `/users?${search}` : "/users");
    });
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(query, sort);
      }}
      className="surface-card flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <Input
          type="search"
          inputMode="search"
          placeholder="Buscar por nombre o usuario…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar usuarios"
        />
      </div>

      <div className="sm:w-56">
        <Select
          value={sort}
          aria-label="Ordenar usuarios"
          onChange={(event) => {
            const next = event.target.value as DirectorySort;
            setSort(next);
            navigate(query, next);
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="tabular-nums">{totalCount} usuarios</span>
        {isPending && <span className="text-electric">Cargando…</span>}
      </div>
    </form>
  );
}

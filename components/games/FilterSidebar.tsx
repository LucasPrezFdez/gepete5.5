"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

const filterGroups = {
  platform: {
    label: "Plataforma",
    icon: PlatformIcon,
    values: ["PC", "PlayStation 5", "Xbox Series", "Nintendo Switch", "Mobile"]
  },
  genre: {
    label: "Género",
    icon: GenreIcon,
    values: ["RPG", "Acción", "Survival Horror", "Open World", "Metroidvania"]
  },
  status: {
    label: "Estado",
    icon: StatusIcon,
    values: [
      { label: "Lanzado", value: "released" },
      { label: "Próximo", value: "upcoming" },
      { label: "Early Access", value: "early_access" }
    ]
  }
} as const;

const scoreRanges = [
  { label: "9+", value: "9", accent: "from-lime/30 to-lime/5 text-lime border-lime/40" },
  { label: "8+", value: "8", accent: "from-electric/30 to-electric/5 text-blue-200 border-electric/40" },
  { label: "7+", value: "7", accent: "from-violet/30 to-violet/5 text-violet-200 border-violet/40" }
];

const trackedKeys = ["platform", "genre", "status", "scoreMin", "year"] as const;

export function FilterSidebar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(key: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (!value || params.get(key) === value) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function updateSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (value === "popular") params.delete("sort");
    else params.set("sort", value);
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const activeFilters = trackedKeys.filter((key) => searchParams.get(key));
  const activeCount = activeFilters.length;

  const content = (
    <aside className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-electric/15 text-electric">
            <FilterIcon />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Filtros</h2>
        </div>
        {activeCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-electric/15 px-2.5 py-0.5 text-xs font-semibold text-electric">
            <span className="h-1.5 w-1.5 rounded-full bg-electric" />
            {activeCount} {activeCount === 1 ? "activo" : "activos"}
          </span>
        ) : (
          <span className="text-xs text-muted/70">Sin filtros</span>
        )}
      </div>

      <div>
        <label htmlFor="sort" className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <SortIcon />
          Ordenar por
        </label>
        <Select id="sort" className="w-full" value={searchParams.get("sort") ?? "popular"} onChange={(event) => updateSort(event.target.value)}>
          <option value="popular">Popularidad</option>
          <option value="score">Mejor puntuados</option>
          <option value="recent">Más recientes</option>
          <option value="upcoming">Próximos lanzamientos</option>
          <option value="reviewed">Más reseñados</option>
        </Select>
      </div>

      {Object.entries(filterGroups).map(([key, group]) => {
        const Icon = group.icon;
        const currentValue = searchParams.get(key);
        return (
          <div key={key} className="border-t border-white/5 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <Icon />
                {group.label}
              </h3>
              {currentValue && (
                <Link
                  href={hrefFor(key)}
                  className="text-[10px] font-medium uppercase tracking-wider text-muted/70 transition hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Limpiar
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.values.map((entry) => {
                const item = typeof entry === "string" ? { label: entry, value: entry } : entry;
                const active = currentValue === item.value;
                return (
                  <Link
                    key={item.value}
                    href={hrefFor(key, item.value)}
                    className={cn(
                      "group relative rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                      active
                        ? "border-electric/60 bg-gradient-to-b from-electric/25 to-electric/10 text-foreground shadow-[0_0_0_1px_rgba(56,189,248,0.15),0_4px_12px_-4px_rgba(56,189,248,0.4)]"
                        : "border-white/10 bg-white/[0.03] text-muted hover:border-white/25 hover:bg-white/[0.06] hover:text-foreground"
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="border-t border-white/5 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <ScoreIcon />
            Puntuación mínima
          </h3>
          {searchParams.get("scoreMin") && (
            <Link
              href={hrefFor("scoreMin")}
              className="text-[10px] font-medium uppercase tracking-wider text-muted/70 transition hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Limpiar
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {scoreRanges.map((range) => {
            const active = searchParams.get("scoreMin") === range.value;
            return (
              <Link
                key={range.value}
                href={hrefFor("scoreMin", range.value)}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-center rounded-lg border px-2 py-2 text-sm font-bold transition-all duration-150",
                  active
                    ? cn("bg-gradient-to-b", range.accent, "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]")
                    : "border-white/10 bg-white/[0.03] text-muted hover:border-white/25 hover:text-foreground"
                )}
              >
                {range.label}
              </Link>
            );
          })}
        </div>
      </div>

      {activeCount > 0 && (
        <div className="border-t border-white/5 pt-5">
          <Button asChild href="/games" variant="secondary" className="w-full gap-2">
            <span className="inline-flex items-center justify-center gap-2">
              <ClearIcon />
              Limpiar todos los filtros
            </span>
          </Button>
        </div>
      )}
    </aside>
  );

  return (
    <>
      <Button variant="secondary" className="mb-4 inline-flex items-center gap-2 lg:hidden" onClick={() => setOpen(true)}>
        <FilterIcon />
        Filtros
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-electric px-1.5 text-[10px] font-bold text-background">
            {activeCount}
          </span>
        )}
      </Button>
      <div className="hidden lg:block">{content}</div>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="ml-auto h-full w-[88vw] max-w-sm overflow-auto border-l border-white/10 bg-background p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filtros</h2>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h13M3 12h9M3 18h5M17 8V20M17 20l3-3M17 20l-3-3" />
    </svg>
  );
}

function PlatformIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <path d="M7 12h3M8.5 10.5v3M15 11h.01M17 13h.01" />
    </svg>
  );
}

function GenreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3-8 3 8M5 21l4-10M19 21l-4-10M5 21h14" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ScoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 2 3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

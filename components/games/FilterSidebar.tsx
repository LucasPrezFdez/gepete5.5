"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

const filterGroups = {
  platform: {
    label: "Plataforma",
    values: ["PC", "PlayStation 5", "Xbox Series", "Nintendo Switch", "Mobile"]
  },
  genre: {
    label: "Género",
    values: ["RPG", "Acción", "Survival Horror", "Open World", "Metroidvania"]
  },
  status: {
    label: "Estado",
    values: [
      { label: "Lanzado", value: "released" },
      { label: "Próximo", value: "upcoming" },
      { label: "Early Access", value: "early_access" }
    ]
  }
};

const scoreRanges = [
  { label: "9+", value: "9", tone: "lime" as const },
  { label: "8+", value: "8", tone: "blue" as const },
  { label: "7+", value: "7", tone: "violet" as const }
];

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

  const activeFilters = ["platform", "genre", "status", "scoreMin", "year"].filter((key) => searchParams.get(key));

  const content = (
    <aside className="space-y-6">
      <div>
        <label htmlFor="sort" className="mb-2 block text-sm font-semibold">
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

      {Object.entries(filterGroups).map(([key, group]) => (
        <div key={key}>
          <h3 className="mb-3 font-semibold">{group.label}</h3>
          <div className="flex flex-wrap gap-2">
            {group.values.map((entry) => {
              const item = typeof entry === "string" ? { label: entry, value: entry } : entry;
              const active = searchParams.get(key) === item.value;
              return (
                <Link
                  key={item.value}
                  href={hrefFor(key, item.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    active
                      ? "border-electric/60 bg-electric/15 text-foreground"
                      : "border-white/10 bg-white/5 text-muted hover:border-electric/50 hover:text-foreground"
                  )}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h3 className="mb-3 font-semibold">Rango de puntuación</h3>
        <div className="grid grid-cols-2 gap-2">
          {scoreRanges.map((range) => (
            <Link key={range.value} href={hrefFor("scoreMin", range.value)} onClick={() => setOpen(false)}>
              <Badge tone={searchParams.get("scoreMin") === range.value ? range.tone : "muted"}>{range.label}</Badge>
            </Link>
          ))}
          <Link href={hrefFor("scoreMin")} onClick={() => setOpen(false)}>
            <Badge tone="muted">Sin filtro</Badge>
          </Link>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <Button asChild href="/games" variant="secondary" className="w-full">
          Limpiar filtros
        </Button>
      )}
    </aside>
  );

  return (
    <>
      <Button variant="secondary" className="mb-4 lg:hidden" onClick={() => setOpen(true)}>
        Abrir filtros
      </Button>
      <div className="hidden lg:block">{content}</div>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/70 lg:hidden" onClick={() => setOpen(false)}>
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

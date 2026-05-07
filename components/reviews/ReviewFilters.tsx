"use client";

import { Select } from "@/components/ui/Select";

export function ReviewFilters() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row">
      <Select aria-label="Ordenar reseñas" defaultValue="popular">
        <option value="popular">Más útiles</option>
        <option value="recent">Más recientes</option>
        <option value="score-high">Nota alta</option>
        <option value="score-low">Nota baja</option>
      </Select>
      <Select aria-label="Filtrar spoilers" defaultValue="hide-spoilers">
        <option value="hide-spoilers">Ocultar spoilers</option>
        <option value="show-all">Mostrar todo</option>
        <option value="only-spoilers">Solo spoilers</option>
      </Select>
    </div>
  );
}


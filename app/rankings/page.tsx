import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/sections/SectionHeader";

export const metadata: Metadata = {
  title: "Rankings",
  description: "Rankings de videojuegos por nota, plataforma, género, década y popularidad."
};

const rankings = [
  ["Top 250 videojuegos", "/rankings/top-250"],
  ["Mejores juegos por plataforma", "/platforms/pc"],
  ["Mejores juegos por género", "/genres/rpg"],
  ["Mejores juegos por década", "/rankings/top-250"],
  ["Juegos más esperados", "/games?status=upcoming"],
  ["Mejores reseñas recientes", "/rankings/top-250"]
];

export default function RankingsPage() {
  return (
    <section className="container-page py-10">
      <SectionHeader eyebrow="Rankings transparentes" title="Rankings de GameIndex" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rankings.map(([title, href]) => (
          <Link
            key={title}
            href={href}
            className="surface-card rounded-2xl p-6 transition hover:-translate-y-1 hover:border-electric/45"
          >
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Criterio: media ponderada, mínimo de votos y actualización periódica para evitar sesgos por pocas valoraciones.
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}


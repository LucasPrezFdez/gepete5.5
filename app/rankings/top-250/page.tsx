import type { Metadata } from "next";
import { RankingTable } from "@/components/rankings/RankingTable";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { getExploreGames } from "@/services/games";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top videojuegos",
  description: "Ranking de videojuegos con datos obtenidos desde la API configurada."
};

export default async function Top250Page() {
  const gamesResult = await getExploreGames({ pageSize: 50 });
  const ranked = [...gamesResult.games]
    .filter((game) => game.userScore > 0)
    .sort((a, b) => b.userScore - a.userScore);

  return (
    <section className="container-page py-10">
      <SectionHeader eyebrow="Ranking API" title="Los mejores videojuegos según la API" />
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-muted">
        Datos cargados desde {gamesResult.source === "none" ? "la API configurada" : gamesResult.source.toUpperCase()}.
        {gamesResult.error ? ` ${gamesResult.error}` : ""}
      </div>
      <RankingTable games={ranked} />
    </section>
  );
}

import type { Metadata } from "next";
import { GameGrid } from "@/components/games/GameGrid";
import { RankingTable } from "@/components/rankings/RankingTable";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { getExploreGames } from "@/services/games";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replaceAll("-", " ") };
}

export default async function CompanyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const name = slug.replaceAll("-", " ");
  const gamesResult = await getExploreGames({ query: name, pageSize: 24 });
  const games = gamesResult.games;

  return (
    <section className="container-page py-10">
      <div className="surface-card mb-8 rounded-3xl p-8">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-2xl font-black">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="mt-5 text-4xl font-black capitalize">{name}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="blue">Datos desde API</Badge>
          <Badge tone="muted">Fuente: {gamesResult.source === "none" ? "no disponible" : gamesResult.source.toUpperCase()}</Badge>
        </div>
        {gamesResult.error && <p className="mt-4 text-sm text-danger">{gamesResult.error}</p>}
      </div>
      <SectionHeader title="Juegos relacionados" />
      <GameGrid games={games} />
      <div className="mt-10">
        <SectionHeader title="Ranking de sus mejores juegos" />
        <RankingTable games={[...games].filter((game) => game.userScore > 0).sort((a, b) => b.userScore - a.userScore)} />
      </div>
    </section>
  );
}

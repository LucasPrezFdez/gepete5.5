import type { Metadata } from "next";
import { GameGrid } from "@/components/games/GameGrid";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { getExploreGames } from "@/services/games";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const label = slug.replaceAll("-", " ");
  const title = `Juegos de ${label}`;
  const description = `Los mejores videojuegos de género ${label}, valoraciones y reseñas en GameIndex.`;
  return {
    title,
    description,
    alternates: { canonical: `/genres/${encodeURIComponent(slug)}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description }
  };
}

export default async function GenrePage({ params }: { params: Params }) {
  const { slug } = await params;
  const label = slug.replaceAll("-", " ");
  const gamesResult = await getExploreGames({ query: label, pageSize: 24 });

  return (
    <section className="container-page py-10">
      <SectionHeader eyebrow="Género" title={`Juegos de ${label}`} />
      {gamesResult.error && <p className="mb-5 text-sm text-danger">{gamesResult.error}</p>}
      <GameGrid games={gamesResult.games} />
    </section>
  );
}

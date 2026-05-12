import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameHero } from "@/components/games/GameHero";
import { GameCommunity } from "@/components/games/GameCommunity";
import { MediaGallery } from "@/components/games/MediaGallery";
import { GameDlcs } from "@/components/games/GameDlcs";
import { GameLinks } from "@/components/games/GameLinks";
import { GameReleaseDates } from "@/components/games/GameReleaseDates";
import { GameGrid } from "@/components/games/GameGrid";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ScoreDistribution } from "@/components/ratings/ScoreDistribution";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  getGameBySlug,
  getGameRichDetailsBySlug,
  getIgdbScoreSummaryByGameSlug,
  getSimilarGames
} from "@/services/games";
import { createServiceDatabaseClient } from "@/services/database";
import { reviewFromRow } from "@/services/community";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};

  return {
    title: `${game.title} (${game.year || "TBA"})`,
    description: game.summary,
    openGraph: {
      title: `${game.title} | GameIndex`,
      description: game.summary,
      images: [game.coverUrl]
    }
  };
}

export default async function GameDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [similar, reviews, igdbScores, richDetails] = await Promise.all([
    getSimilarGames(game, 6),
    getReviewSnippets(game.slug),
    getIgdbScoreSummaryByGameSlug(game.slug),
    getGameRichDetailsBySlug(game.slug)
  ]);

  const screenshots = richDetails?.screenshots ?? [];
  const videos = richDetails?.videos ?? [];
  const dlcs = richDetails?.dlcs ?? [];
  const releaseDates = richDetails?.releaseDates ?? [];
  const websites = richDetails?.websites ?? [];
  const franchiseLabel =
    richDetails?.franchises?.map((entry) => entry.name).filter(Boolean).join(", ") || game.franchise || "Independiente";
  const gameModesLabel =
    richDetails?.gameModes?.filter(Boolean).join(", ") || (game.modes.length ? game.modes.join(", ") : "Información no disponible");

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.summary,
    genre: game.genres,
    gamePlatform: game.platforms,
    datePublished: game.releaseDate,
    aggregateRating:
      game.userScore > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: game.userScore,
            ratingCount: game.ratings,
            bestRating: 10,
            worstRating: 1
          }
        : undefined
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <GameHero game={game} />

      <nav className="container-page sticky top-20 z-30 -mb-4 flex gap-2 overflow-x-auto border-b border-white/10 bg-background/90 py-3 backdrop-blur">
        {[
          ["Resumen", "summary"],
          ["Comunidad", "community-rating"],
          ["Reseñas", "reviews"],
          ["Medios", "media"],
          ["Similares", "similar"]
        ].map(([label, id]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted transition hover:border-electric/50 hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>

      <section id="summary" className="container-page grid gap-8 py-10 lg:grid-cols-[1.1fr_.9fr]">
        <div id="media" className="space-y-5">
          <MediaGallery game={game} screenshots={screenshots} videos={videos} />
          <GameDlcs dlcs={dlcs} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader><h2 className="text-xl font-bold">Sinopsis</h2></CardHeader>
            <CardContent><p className="leading-7 text-muted">{game.summary}</p></CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="text-xl font-bold">Información clave</h2></CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <Info label="Fecha de lanzamiento" value={game.releaseDate} />
                <Info label="Desarrolladora" value={game.developer} />
                <Info label="Publisher" value={game.publisher} />
                <Info label="Motor gráfico" value={game.engine ?? "No disponible"} />
                <Info label="Modos" value={gameModesLabel} />
                <Info label="Saga/franquicia" value={franchiseLabel} />
              </dl>
            </CardContent>
          </Card>

          <GameReleaseDates releaseDates={releaseDates} />
          <GameLinks websites={websites} />

          <Card>
            <CardHeader><h2 className="text-xl font-bold">Dónde jugar</h2></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {game.platforms.map((platform) => <Badge key={platform} tone="blue">{platform}</Badge>)}
              </div>
              <p className="mt-3 text-sm text-muted">Plataformas sincronizadas desde Neon, IGDB o RAWG.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <GameCommunity game={game} />

      <section id="reviews" className="container-page py-8">
        <SectionHeader title="Reseñas y puntuaciones" href={`/games/${game.slug}/reviews`} />
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <ScoreDistribution
            averageScore={igdbScores?.averageScore}
            ratingsCount={igdbScores?.ratingsCount}
            criticScore={igdbScores?.criticScore}
            source={igdbScores?.source ?? "IGDB"}
          />
          <div className="space-y-4">
            {reviews.length ? reviews.map((review: any) => <ReviewCard key={review.id} {...review} />) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">
                Todavía no hay reseñas largas. <Link href={`/games/${game.slug}/reviews`} className="text-electric hover:underline">Escribe la primera reseña.</Link>
              </div>
            )}
            <Button asChild href={`/games/${game.slug}/reviews`} variant="secondary">Ver todas las reseñas</Button>
          </div>
        </div>
      </section>

      <section id="similar" className="container-page py-8">
        <SectionHeader title="Juegos similares" />
        {similar.length ? <GameGrid games={similar} /> : <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">Aún no hay suficientes juegos similares indexados.</div>}
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[180px_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

async function getReviewSnippets(slug: string) {
  try {
    const serviceClient = createServiceDatabaseClient();
    const { data, error } = await serviceClient
      .from("reviews")
      .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), games:game_id!inner(slug,title)")
      .eq("games.slug", slug)
      .order("helpful_count", { ascending: false })
      .limit(3);
    if (error) return [];
    return (data ?? []).map(reviewFromRow);
  } catch {
    return [];
  }
}




import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewFilters } from "@/components/reviews/ReviewFilters";
import { ScoreDistribution } from "@/components/ratings/ScoreDistribution";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Button } from "@/components/ui/Button";
import { getGameBySlug, getIgdbScoreSummaryByGameSlug } from "@/services/games";
import { createServiceDatabaseClient } from "@/services/database";
import { reviewFromRow } from "@/services/community";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  return {
    title: game ? `Reseñas de ${game.title}` : "Reseñas",
    description: game ? `Lee reseñas de usuarios, distribución de puntuaciones y opiniones sobre ${game.title}.` : undefined
  };
}

export default async function GameReviewsPage({ params }: { params: Params }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const [{ reviews, error }, igdbScores] = await Promise.all([
    getReviews(slug),
    getIgdbScoreSummaryByGameSlug(game.slug)
  ]);

  return (
    <section className="container-page py-10">
      <SectionHeader eyebrow="Comunidad" title={`Reseñas de ${game.title}`} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <ScoreDistribution
            averageScore={igdbScores?.averageScore}
            ratingsCount={igdbScores?.ratingsCount}
            criticScore={igdbScores?.criticScore}
            source={igdbScores?.source ?? "IGDB"}
          />
          <Button asChild href={`/games/${game.slug}#community-rating`} className="w-full" variant="secondary">
            Valorar con comentario corto
          </Button>
          <ReviewForm game={game} />
        </div>
        <div className="space-y-4">
          <ReviewFilters />
          {error && <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">{error}</div>}
          {!error && reviews.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-6 text-muted">
              Todavía no hay reseñas largas. Publica la primera y ayuda a la comunidad a decidir qué jugar.
            </div>
          )}
          {reviews.map((review: any) => (
            <ReviewCard key={review.id} {...review} />
          ))}
        </div>
      </div>
    </section>
  );
}

async function getReviews(slug: string) {
  try {
    const serviceClient = createServiceDatabaseClient();
    const { data, error } = await serviceClient
      .from("reviews")
      .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), games:game_id!inner(slug,title)")
      .eq("games.slug", slug)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return { reviews: (data ?? []).map(reviewFromRow), error: null };
  } catch (error) {
    return { reviews: [], error: error instanceof Error ? error.message : "No se pudieron cargar las reseñas." };
  }
}



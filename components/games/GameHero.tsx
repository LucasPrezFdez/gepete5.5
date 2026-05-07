import Image from "next/image";
import { Game } from "@/data/games";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GameLibraryActions } from "@/components/games/GameLibraryActions";
import { GenreBadge } from "@/components/games/GenreBadge";
import { PlatformBadge } from "@/components/games/PlatformBadge";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { UserRatingModal } from "@/components/ratings/UserRatingModal";
import { formatCompactNumber } from "@/lib/utils";

export function GameHero({ game }: { game: Game }) {
  const yearLabel = game.year > 0 ? String(game.year) : "Fecha por anunciar";

  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <Image
        src={game.heroUrl}
        alt=""
        fill
        priority
        className="object-cover opacity-25 blur-sm"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
      <div className="container-page relative grid gap-8 py-10 lg:grid-cols-[260px_1fr] lg:py-16">
        <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/10 shadow-card">
          <Image
            src={game.coverUrl}
            alt={`Cover de ${game.title}`}
            fill
            priority
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-end">
          <div className="flex flex-wrap gap-2">
            <Badge tone={game.status === "released" ? "blue" : "lime"}>
              {game.status === "released"
                ? "Lanzado"
                : game.status === "upcoming"
                  ? "Próximo"
                  : "Early Access"}
            </Badge>
            {game.genres.map((genre) => (
              <GenreBadge key={genre}>{genre}</GenreBadge>
            ))}
          </div>

          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-balance md:text-6xl">
            {game.title}
          </h1>
          <p className="mt-3 text-lg text-muted">
            {yearLabel} · {game.developer} · {game.publisher}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {game.platforms.map((platform) => (
              <PlatformBadge key={platform}>{platform}</PlatformBadge>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RatingBadge score={game.userScore} label="Usuarios" />
            <RatingBadge
              score={game.criticScore ? game.criticScore / 10 : null}
              label="Crítica"
            />
            <span className="text-sm text-muted">
              {formatCompactNumber(game.ratings)} valoraciones ·{" "}
              {formatCompactNumber(game.reviews)} reseñas
            </span>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <UserRatingModal game={game} />
            <Button asChild href={`/games/${game.slug}/reviews`} variant="ghost">Escribir reseña</Button>
          </div>
          <div className="mt-4">
            <GameLibraryActions game={game} />
          </div>
        </div>
      </div>
    </section>
  );
}



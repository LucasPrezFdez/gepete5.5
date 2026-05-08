import Image from "next/image";
import Link from "next/link";
import { Game } from "@/data/games";
import { formatCompactNumber, prioritizePlatform } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ratings/RatingBadge";

export function GameCard({
  game,
  priority = false,
  highlightPlatform
}: {
  game: Game;
  priority?: boolean;
  highlightPlatform?: string | null;
}) {
  const yearLabel = game.year > 0 ? String(game.year) : "Fecha por anunciar";
  const orderedPlatforms = prioritizePlatform(game.platforms, highlightPlatform);

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-surface/85 shadow-card transition duration-300 hover:-translate-y-1 hover:border-electric/45 hover:shadow-glow">
      <Link href={`/games/${game.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
          <Image
            src={game.coverUrl}
            alt={`Cover de ${game.title}`}
            fill
            priority={priority}
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 220px"
          />
          <div className="absolute left-3 top-3">
            <RatingBadge score={game.userScore} compact />
          </div>
          {game.status !== "released" && (
            <Badge
              tone={game.status === "upcoming" ? "lime" : "violet"}
              className="absolute bottom-3 left-3"
            >
              {game.status === "upcoming" ? "Próximo" : "Early Access"}
            </Badge>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div>
            <h3 className="line-clamp-2 font-bold leading-tight text-foreground">
              {game.title}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {yearLabel} · {orderedPlatforms.slice(0, 2).join(", ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {game.genres.slice(0, 2).map((genre) => (
              <Badge key={genre} tone="muted">
                {genre}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted">
            {formatCompactNumber(game.reviews)} reseñas ·{" "}
            {formatCompactNumber(game.ratings)} valoraciones
          </p>
        </div>
      </Link>
    </article>
  );
}


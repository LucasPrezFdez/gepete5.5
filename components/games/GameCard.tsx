import Image from "next/image";
import Link from "next/link";
import { Game } from "@/data/games";
import { prioritizePlatform } from "@/lib/utils";
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
    <article className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/90 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-electric/35 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(59,130,246,0.12)]">
      <Link href={`/games/${game.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-white/5">
          <Image
            src={game.coverUrl}
            alt={`Cover de ${game.title}`}
            fill
            priority={priority}
            className="object-cover transition duration-500 group-hover:scale-[1.06]"
            sizes="(max-width: 768px) 50vw, 220px"
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          <div className="absolute left-2.5 top-2.5">
            <RatingBadge score={game.userScore} compact />
          </div>
          {game.status !== "released" && (
            <Badge
              tone={game.status === "upcoming" ? "lime" : "violet"}
              className="absolute bottom-2.5 left-2.5"
            >
              {game.status === "upcoming" ? "Próximo" : "Early Access"}
            </Badge>
          )}
        </div>
        <div className="space-y-2 p-3.5">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors duration-150 group-hover:text-electric">
            {game.title}
          </h3>
          <p className="text-[11.5px] text-muted/70">
            {yearLabel}
            {game.developer ? ` · ${game.developer}` : orderedPlatforms[0] ? ` · ${orderedPlatforms[0]}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {game.genres.slice(0, 2).map((genre) => (
              <Badge key={genre} tone="muted" className="text-[10px]">
                {genre}
              </Badge>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}


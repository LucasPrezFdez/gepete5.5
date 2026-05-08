import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/data/games";
import { GameCard } from "@/components/games/GameCard";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { prioritizePlatform } from "@/lib/utils";

export function GameGrid({
  games,
  view = "grid",
  highlightPlatform
}: {
  games: Game[];
  view?: "grid" | "list";
  highlightPlatform?: string | null;
}) {
  if (view === "list") {
    return (
      <div className="space-y-3">
        {games.map((game) => (
          <GameListRow key={game.slug} game={game} highlightPlatform={highlightPlatform} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {games.map((game, index) => (
        <GameCard key={game.slug} game={game} priority={index < 4} highlightPlatform={highlightPlatform} />
      ))}
    </div>
  );
}

function GameListRow({ game, highlightPlatform }: { game: Game; highlightPlatform?: string | null }) {
  const yearLabel = game.year > 0 ? String(game.year) : "TBA";
  const orderedPlatforms = prioritizePlatform(game.platforms, highlightPlatform);
  return (
    <Link
      href={`/games/${game.slug}`}
      className="surface-card grid gap-4 rounded-2xl p-3 transition hover:-translate-y-0.5 hover:border-electric/45 sm:grid-cols-[86px_1fr_auto] sm:items-center"
    >
      <div className="relative aspect-[3/4] w-20 overflow-hidden rounded-xl bg-white/5 sm:w-[86px]">
        {game.coverUrl && <Image src={game.coverUrl} alt={`Cover de ${game.title}`} fill className="object-cover" sizes="86px" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black">{game.title}</h3>
          <Badge tone={game.status === "released" ? "muted" : "lime"}>{game.status === "released" ? yearLabel : "Próximo"}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {yearLabel} · {game.developer} · {orderedPlatforms.slice(0, 3).join(", ")}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{game.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {game.genres.slice(0, 4).map((genre) => (
            <Badge key={genre} tone="muted">
              {genre}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
        <RatingBadge score={game.userScore} label="Usuarios" />
        <span className="text-xs text-muted">{game.ratings.toLocaleString("es-ES")} valoraciones</span>
      </div>
    </Link>
  );
}

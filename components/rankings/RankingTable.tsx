import Image from "next/image";
import Link from "next/link";
import { Game } from "@/data/games";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { formatCompactNumber } from "@/lib/utils";

export function RankingTable({ games }: { games: Game[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Juego</th>
            <th className="hidden px-4 py-3 md:table-cell">Plataformas</th>
            <th className="px-4 py-3">Nota</th>
            <th className="hidden px-4 py-3 lg:table-cell">Votos</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, index) => (
            <tr key={game.slug} className="border-t border-white/10 hover:bg-white/5">
              <td className="px-4 py-4 font-bold text-muted">{index + 1}</td>
              <td className="px-4 py-4">
                <Link href={`/games/${game.slug}`} className="group flex items-center gap-3">
                  <span className="relative block h-16 w-12 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                    {game.coverUrl ? (
                      <Image
                        src={game.coverUrl}
                        alt={`Cover de ${game.title}`}
                        fill
                        sizes="48px"
                        className="object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-muted">
                        Sin cover
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold group-hover:text-electric">
                      {game.title}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {game.year} · {game.genres.join(", ")}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="hidden px-4 py-4 text-muted md:table-cell">
                {game.platforms.slice(0, 3).join(", ")}
              </td>
              <td className="px-4 py-4">
                <RatingBadge score={game.userScore} compact />
              </td>
              <td className="hidden px-4 py-4 text-muted lg:table-cell">
                {formatCompactNumber(game.ratings)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


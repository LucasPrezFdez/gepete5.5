import Image from "next/image";
import Link from "next/link";
import { Game } from "@/data/games";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { cn, formatCompactNumber } from "@/lib/utils";

const MEDAL = [
  { num: "text-[#F5C842] font-black", row: "bg-[#F5C842]/[0.04] hover:bg-[#F5C842]/[0.07]" },
  { num: "text-[#B8C4CE] font-black", row: "bg-[#B8C4CE]/[0.03] hover:bg-[#B8C4CE]/[0.06]" },
  { num: "text-[#C87941] font-black", row: "bg-[#C87941]/[0.03] hover:bg-[#C87941]/[0.06]" }
];

export function RankingTable({ games }: { games: Game[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.07] bg-white/[0.03]">
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted/50">#</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted/50">Juego</th>
            <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted/50 md:table-cell">Plataformas</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted/50">Nota</th>
            <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted/50 lg:table-cell">Votos</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, index) => {
            const medal = index < 3 ? MEDAL[index] : null;
            return (
              <tr
                key={game.slug}
                className={cn(
                  "border-t border-white/[0.06] transition-colors duration-150",
                  medal ? medal.row : "hover:bg-white/[0.04]"
                )}
              >
                <td className="px-4 py-3.5">
                  <span className={cn("tabular-nums text-sm", medal ? medal.num : "text-muted/60 font-medium")}>
                    {index + 1}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/games/${game.slug}`} className="group flex items-center gap-3">
                    <span className="relative block h-[52px] w-[38px] flex-shrink-0 overflow-hidden rounded-[7px] border border-white/10 bg-white/5">
                      {game.coverUrl ? (
                        <Image
                          src={game.coverUrl}
                          alt={`Cover de ${game.title}`}
                          fill
                          sizes="38px"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.08]"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wide text-muted/40">
                          N/A
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold transition-colors duration-150 group-hover:text-electric">
                        {game.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted/60">
                        {game.year} · {game.genres.slice(0, 2).join(", ")}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3.5 text-xs text-muted/60 md:table-cell">
                  {game.platforms.slice(0, 3).join(", ")}
                </td>
                <td className="px-4 py-3.5">
                  <RatingBadge score={game.userScore} compact />
                </td>
                <td className="hidden px-4 py-3.5 text-xs text-muted/60 lg:table-cell">
                  {formatCompactNumber(game.ratings)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


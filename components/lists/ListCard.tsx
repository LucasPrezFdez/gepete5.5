import Link from "next/link";
import { formatCompactNumber } from "@/lib/utils";

type ListCardGame = string | {
  title: string;
  coverUrl?: string | null;
};

export function ListCard({
  slug,
  title,
  description,
  likes,
  games
}: {
  slug: string;
  title: string;
  description: string;
  likes: number;
  games: ListCardGame[];
}) {
  const previewGames = games.slice(0, 3).map(normalizeGame);

  return (
    <Link
      href={`/lists/${slug}`}
      className="surface-card group block overflow-hidden transition hover:-translate-y-1 hover:border-electric/45"
    >
      <div className="grid h-40 grid-cols-3 gap-2 bg-white/5 p-2">
        {previewGames.length > 0 ? (
          previewGames.map((game, index) => (
            <div
              key={`${game.title}-${index}`}
              className="overflow-hidden rounded-2xl border border-white/10 bg-background/60 shadow-inner transition duration-300 group-hover:-translate-y-1 group-hover:border-electric/40"
              style={{ transitionDelay: `${index * 40}ms` }}
            >
              {game.coverUrl ? (
                <img
                  src={game.coverUrl}
                  alt={game.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center bg-gradient-to-br from-surface to-background p-3 text-center text-xs font-bold text-muted">
                  {game.title}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-3 grid place-items-center rounded-2xl border border-dashed border-white/10 bg-background/60 p-4 text-center text-sm text-muted">
            Lista sin juegos todavía
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{description}</p>
        <p className="mt-4 text-xs text-muted">{formatCompactNumber(likes)} likes</p>
      </div>
    </Link>
  );
}

function normalizeGame(game: ListCardGame) {
  if (typeof game === "string") return { title: game, coverUrl: null };
  return { title: game.title, coverUrl: game.coverUrl ?? null };
}

import Link from "next/link";
import { formatCompactNumber } from "@/lib/utils";

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
  games: string[];
}) {
  return (
    <Link
      href={`/lists/${slug}`}
      className="surface-card group block overflow-hidden transition hover:-translate-y-1 hover:border-electric/45"
    >
      <div className="grid h-36 grid-cols-3 gap-1 bg-white/5">
        {games.slice(0, 3).map((game, index) => (
          <div
            key={game}
            className="grid place-items-center bg-gradient-to-br from-electric/20 to-violet/20 p-2 text-center text-xs font-bold text-muted transition group-hover:text-foreground"
            style={{ transitionDelay: `${index * 40}ms` }}
          >
            {game}
          </div>
        ))}
      </div>
      <div className="p-5">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{description}</p>
        <p className="mt-4 text-xs text-muted">{formatCompactNumber(likes)} likes</p>
      </div>
    </Link>
  );
}

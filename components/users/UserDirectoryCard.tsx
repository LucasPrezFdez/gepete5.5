import Image from "next/image";
import Link from "next/link";
import type { DirectoryUserCard } from "@/services/users";
import { formatCompactNumber } from "@/lib/utils";

export function UserDirectoryCard({ user }: { user: DirectoryUserCard }) {
  const { profile, stats } = user;
  const initials = (profile.displayName || profile.username).slice(0, 2).toUpperCase();
  const platforms = profile.favoritePlatforms.slice(0, 3);
  const genres = profile.favoriteGenres.slice(0, 2);

  return (
    <Link
      href={`/users/${encodeURIComponent(profile.username)}`}
      className="group surface-card relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-electric/45 hover:bg-white/[0.05]"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-electric/20 to-transparent opacity-0 blur-2xl transition group-hover:opacity-100" aria-hidden />

      <div className="relative flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-sm font-black text-foreground">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-foreground group-hover:text-electric">
            {profile.displayName}
          </p>
          <p className="truncate text-xs text-muted">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {(platforms.length > 0 || genres.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {platforms.map((platform) => (
            <span
              key={`p-${platform}`}
              className="rounded-full border border-electric/30 bg-electric/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-100"
            >
              {platform}
            </span>
          ))}
          {genres.map((genre) => (
            <span
              key={`g-${genre}`}
              className="rounded-full border border-lime/30 bg-lime/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lime"
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto grid grid-cols-4 gap-2 border-t border-white/[0.06] pt-3 text-center">
        <Stat label="Valoraciones" value={formatCompactNumber(stats.ratingsCount)} />
        <Stat label="Completados" value={formatCompactNumber(stats.completedCount)} />
        <Stat label="Listas" value={String(stats.listsCount)} />
        <Stat label="Seguidores" value={formatCompactNumber(stats.followerCount)} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

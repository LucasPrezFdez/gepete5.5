import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameGrid } from "@/components/games/GameGrid";
import { ListCard } from "@/components/lists/ListCard";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { UserProfileHeader } from "@/components/users/UserProfileHeader";
import { communityLists } from "@/data/community";
import type { Profile, ProfileStats } from "@/data/games";
import { getExploreGames } from "@/services/games";
import { getProfileRowByUsername, getPublicUserProfile, type PublicProfileActivity } from "@/services/users";

type Params = Promise<{ username: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  let row: Awaited<ReturnType<typeof getProfileRowByUsername>> | null = null;
  try {
    row = await getProfileRowByUsername(username);
  } catch {
    row = null;
  }

  const displayName = row?.display_name ?? username;
  const title = `${displayName} (@${username})`;
  const description = row?.bio
    ? row.bio
    : `Actividad, listas, reseñas y backlog de @${username} en GameIndex.`;
  const avatar = row?.avatar_url ?? undefined;
  const canonical = `/users/${encodeURIComponent(username)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "profile",
      url: canonical,
      images: avatar ? [avatar] : undefined
    },
    twitter: {
      card: avatar ? "summary_large_image" : "summary",
      title,
      description,
      images: avatar ? [avatar] : undefined
    },
    robots: row ? { index: true, follow: true } : { index: false, follow: true }
  };
}

export default async function UserPage({ params }: { params: Params }) {
  const { username } = await params;
  const profile = await loadProfile(username);

  if (!profile) {
    if (username !== "norapixel") notFound();
    return <FallbackUserPage />;
  }

  return (
    <section className="container-page space-y-10 py-10">
      <UserProfileHeader profile={profile.profile} stats={profile.stats} />

      <div className="space-y-4">
        <ProfileStatsBar stats={profile.stats} />
        <ProfilePreferencesBar profile={profile.profile} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10 min-w-0">
          <div>
            <SectionHeader eyebrow="Colecciones" title="Listas públicas" />
            {profile.lists.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {profile.lists.map((list) => (
                  <ListCard key={list.slug} slug={list.slug} title={list.title} description={list.description ?? ""} likes={list.likesCount} games={list.items.map((item) => ({ title: item.game.title, coverUrl: item.game.coverUrl }))} />
                ))}
              </div>
            ) : (
              <EmptyProfileSection title="Todavía no hay listas públicas" description="Las listas públicas del usuario se mostrarán en esta sección." />
            )}
          </div>

          <div>
            <SectionHeader eyebrow="Críticas" title="Reseñas recientes" />
            {profile.reviews.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {profile.reviews.map((review) => <ReviewCard key={review.id} {...review} />)}
              </div>
            ) : (
              <EmptyProfileSection title="Todavía no hay reseñas largas" description="Las reseñas extensas publicadas por este perfil aparecerán aquí." />
            )}
          </div>
        </div>

        <ActivitySidebar activity={profile.activity} />
      </div>
    </section>
  );
}

type ActivityType = "rating" | "review" | "list" | "status" | "favorite";

const ACTIVITY_STYLE: Record<ActivityType, { bg: string; text: string; ring: string }> = {
  status:   { bg: "bg-electric/12", text: "text-electric", ring: "ring-electric/20" },
  favorite: { bg: "bg-rose-500/12", text: "text-rose-400", ring: "ring-rose-500/20" },
  list:     { bg: "bg-violet/15",   text: "text-violet",   ring: "ring-violet/25" },
  rating:   { bg: "bg-lime/12",     text: "text-lime",     ring: "ring-lime/20" },
  review:   { bg: "bg-amber-500/12",text: "text-amber-400",ring: "ring-amber-500/20" }
};

function ActivityIcon({ type }: { type: ActivityType }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (type) {
    case "favorite":
      return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>;
    case "list":
      return <svg {...common}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>;
    case "rating":
      return <svg {...common}><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.5 6.7 19.2l1.1-5.9L3.5 9.2l5.9-.8z" /></svg>;
    case "review":
      return <svg {...common}><path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" /></svg>;
    case "status":
    default:
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  }
}

function ActivitySidebar({ activity }: { activity: PublicProfileActivity[] }) {
  const items = activity ?? [];
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <SectionHeader eyebrow="Timeline" title="Actividad reciente" />
      <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
        {items.length ? (
          <ol className="divide-y divide-white/[0.04]">
            {items.slice(0, 8).map((event) => {
              const tone = ACTIVITY_STYLE[(event.type as ActivityType) ?? "status"] ?? ACTIVITY_STYLE.status;
              return (
                <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}>
                    <ActivityIcon type={(event.type as ActivityType) ?? "status"} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-foreground">{event.message}</p>
                    <p className="mt-1 text-[11px] text-muted">{formatRelativeDate(event.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-5 py-6 text-center text-xs text-muted">Sin actividad pública todavía.</p>
        )}
      </div>
    </aside>
  );
}

async function FallbackUserPage() {
  const gamesResult = await getExploreGames({ pageSize: 6 });
  return (
    <section className="container-page space-y-10 py-10">
      <section className="surface-card rounded-3xl p-6 md:p-8">
        <h1 className="text-3xl font-black">Nora Pixel</h1>
        <p className="mt-2 text-muted">Perfil editorial de ejemplo mientras Neon no tiene datos de usuarios.</p>
      </section>
      <div>
        <SectionHeader title="Juegos destacados" />
        {gamesResult.error && <p className="mb-5 text-sm text-danger">{gamesResult.error}</p>}
        <GameGrid games={gamesResult.games} />
      </div>
      <div>
        <SectionHeader title="Listas públicas" />
        <div className="grid gap-4 md:grid-cols-3">
          {communityLists.map((list) => <ListCard key={list.slug} {...list} />)}
        </div>
      </div>
    </section>
  );
}

type StatAccent = "electric" | "violet" | "lime";

const STAT_DOT: Record<StatAccent, string> = {
  electric: "bg-electric",
  violet: "bg-violet",
  lime: "bg-lime"
};

function ProfileStatsBar({ stats }: { stats: ProfileStats }) {
  const items: { label: string; value: string; accent: StatAccent; highlight?: boolean }[] = [
    { label: "Media", value: stats.averageScore ? String(stats.averageScore) : "—", accent: "lime", highlight: Boolean(stats.averageScore) },
    { label: "Valoraciones", value: String(stats.ratingsCount), accent: "electric" },
    { label: "Completados", value: String(stats.completedCount), accent: "lime" },
    { label: "Pendientes", value: String(stats.backlogCount), accent: "violet" },
    { label: "Seguidores", value: String(stats.followerCount), accent: "electric" },
    { label: "Siguiendo", value: String(stats.followingCount), accent: "violet" }
  ];

  return (
    <div className="surface-card relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-electric/15 to-transparent blur-3xl" aria-hidden />
      <ul className="relative grid grid-cols-3 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-6 md:px-6 md:py-5">
        {items.map((item) => (
          <li key={item.label} className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <span className={`h-1 w-1 rounded-full ${STAT_DOT[item.accent]}`} aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{item.label}</span>
            </span>
            <span className={`text-2xl font-black leading-none tabular-nums ${item.highlight ? "text-lime" : "text-foreground"}`}>{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfilePreferencesBar({ profile }: { profile: Profile }) {
  const hasPlatforms = profile.favoritePlatforms.length > 0;
  const hasGenres = profile.favoriteGenres.length > 0;
  if (!hasPlatforms && !hasGenres) return null;

  return (
    <div className="surface-card relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute -left-24 -bottom-20 h-56 w-56 rounded-full bg-gradient-to-br from-electric/20 to-transparent blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-lime/15 to-transparent blur-3xl" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }}
        aria-hidden
      />
      <div className="relative grid gap-3 p-4 md:grid-cols-2 md:gap-4 md:p-5">
        {hasPlatforms && (
          <PrefPanel eyebrow="Hardware" title="Plataformas" accent="electric" values={profile.favoritePlatforms} icon="device" />
        )}
        {hasGenres && (
          <PrefPanel eyebrow="Gustos" title="Generos" accent="lime" values={profile.favoriteGenres} icon="sparkles" />
        )}
      </div>
    </div>
  );
}

type PrefIcon = "device" | "sparkles";

const PREF_PANEL_ACCENTS: Record<PrefAccent, { eyebrow: string; line: string; iconBg: string; iconText: string; chipBorder: string; chipText: string; glow: string }> = {
  electric: {
    eyebrow: "text-electric",
    line: "from-electric/80 to-electric/0",
    iconBg: "bg-electric/15 border-electric/40",
    iconText: "text-electric",
    chipBorder: "border-electric/30 bg-electric/10 hover:border-electric/60 hover:bg-electric/20",
    chipText: "text-blue-100",
    glow: "from-electric/25"
  },
  lime: {
    eyebrow: "text-lime",
    line: "from-lime/80 to-lime/0",
    iconBg: "bg-lime/15 border-lime/40",
    iconText: "text-lime",
    chipBorder: "border-lime/30 bg-lime/10 hover:border-lime/60 hover:bg-lime/20",
    chipText: "text-lime",
    glow: "from-lime/25"
  }
};

function PrefPanel({ eyebrow, title, accent, values, icon }: { eyebrow: string; title: string; accent: PrefAccent; values: string[]; icon: PrefIcon }) {
  const tone = PREF_PANEL_ACCENTS[accent];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${tone.glow} to-transparent opacity-50 blur-2xl transition group-hover:opacity-90`} aria-hidden />
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b ${tone.line}`} aria-hidden />
      <div className="relative flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${tone.iconBg} ${tone.iconText}`}>
          <PrefIconGlyph name={icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${tone.eyebrow}`}>{eyebrow}</p>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {values.map((value) => (
              <span key={value} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${tone.chipBorder} ${tone.chipText}`}>
                {value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrefIconGlyph({ name }: { name: PrefIcon }) {
  if (name === "device") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M6 12h4M8 10v4" />
        <circle cx="16" cy="11" r="1" />
        <circle cx="18.5" cy="13.5" r="1" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />
      <path d="M5 4l.6 1.4L7 6l-1.4.6L5 8l-.6-1.4L3 6l1.4-.6z" />
    </svg>
  );
}

type PrefAccent = "electric" | "lime";

function EmptyProfileSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
      <h3 className="text-base font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
    </div>
  );
}

async function loadProfile(username: string) {
  try {
    return await getPublicUserProfile(username);
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Fecha no disponible";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatRelativeDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr < 24) return `hace ${diffHr} h`;
  if (diffDay < 7) return `hace ${diffDay} d`;
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short" }).format(date);
}

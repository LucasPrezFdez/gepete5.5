import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameGrid } from "@/components/games/GameGrid";
import { ListCard } from "@/components/lists/ListCard";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { UserProfileHeader } from "@/components/users/UserProfileHeader";
import { communityLists } from "@/data/community";
import { getExploreGames } from "@/services/games";
import { getProfileRowByUsername, getPublicUserProfile } from "@/services/users";

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
    <section className="container-page space-y-12 py-10">
      <UserProfileHeader profile={profile.profile} stats={profile.stats} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Media" value={profile.stats.averageScore ? String(profile.stats.averageScore) : "—"} accent="lime" highlight={Boolean(profile.stats.averageScore)} />
        <Stat label="Valoraciones" value={String(profile.stats.ratingsCount)} accent="electric" />
        <Stat label="Completados" value={String(profile.stats.completedCount)} accent="lime" />
        <Stat label="Backlog" value={String(profile.stats.backlogCount)} accent="violet" />
        <Stat label="Seguidores" value={String(profile.stats.followerCount)} accent="electric" />
        <Stat label="Siguiendo" value={String(profile.stats.followingCount)} accent="violet" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PreferenceCard title="Plataformas favoritas" eyebrow="Hardware" accent="electric" values={profile.profile.favoritePlatforms} fallback="Aún no ha elegido plataformas favoritas." />
        <PreferenceCard title="Géneros favoritos" eyebrow="Gustos" accent="lime" values={profile.profile.favoriteGenres} fallback="Aún no ha elegido géneros favoritos." />
      </div>

      <div>
        <SectionHeader eyebrow="Timeline" title="Actividad reciente" />
        {profile.activity.length ? (
          <ol className="relative space-y-3 border-l border-white/10 pl-5">
            {profile.activity.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[26px] top-3 grid h-3 w-3 place-items-center rounded-full bg-electric shadow-[0_0_12px_rgba(59,130,246,0.6)]" aria-hidden />
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm transition hover:border-electric/40 hover:bg-white/[0.07]">
                  <p className="text-foreground">{event.message}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(event.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyProfileSection title="Sin actividad pública todavía" description="Cuando publique reseñas, cree listas o actualice su biblioteca, aparecerá aquí." />
        )}
      </div>

      <div>
        <SectionHeader eyebrow="Colecciones" title="Listas públicas" />
        {profile.lists.length ? (
          <div className="grid gap-4 md:grid-cols-3">
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
          <div className="grid gap-4 lg:grid-cols-2">
            {profile.reviews.map((review) => <ReviewCard key={review.id} {...review} />)}
          </div>
        ) : (
          <EmptyProfileSection title="Todavía no hay reseñas largas" description="Las reseñas extensas publicadas por este perfil aparecerán aquí." />
        )}
      </div>
    </section>
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

const STAT_ACCENTS: Record<StatAccent, { dot: string; glow: string; value: string }> = {
  electric: { dot: "bg-electric", glow: "from-electric/25", value: "text-foreground" },
  violet: { dot: "bg-violet", glow: "from-violet/25", value: "text-foreground" },
  lime: { dot: "bg-lime", glow: "from-lime/25", value: "text-foreground" }
};

function Stat({ label, value, accent = "electric", highlight = false }: { label: string; value: string; accent?: StatAccent; highlight?: boolean }) {
  const tone = STAT_ACCENTS[accent];
  return (
    <div className="surface-card group relative overflow-hidden rounded-2xl p-5 transition hover:border-white/20">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${tone.glow} to-transparent opacity-60 blur-2xl transition group-hover:opacity-100`} aria-hidden />
      <div className="relative flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
      </div>
      <p className={`relative mt-3 text-3xl font-black tabular-nums ${highlight ? "text-lime" : tone.value}`}>{value}</p>
    </div>
  );
}

type PrefAccent = "electric" | "lime";

const PREF_ACCENTS: Record<PrefAccent, { eyebrow: string; line: string; chipBorder: string; chipText: string; glow: string }> = {
  electric: {
    eyebrow: "text-electric",
    line: "bg-electric",
    chipBorder: "border-electric/30 bg-electric/10",
    chipText: "text-blue-200",
    glow: "from-electric/20"
  },
  lime: {
    eyebrow: "text-lime",
    line: "bg-lime",
    chipBorder: "border-lime/30 bg-lime/10",
    chipText: "text-lime",
    glow: "from-lime/20"
  }
};

function PreferenceCard({ title, eyebrow, values, fallback, accent = "electric" }: { title: string; eyebrow?: string; values: string[]; fallback: string; accent?: PrefAccent }) {
  const tone = PREF_ACCENTS[accent];
  return (
    <div className="surface-card relative overflow-hidden rounded-2xl p-6">
      <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${tone.glow} to-transparent blur-3xl`} aria-hidden />
      <div className="relative">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2">
            <span className={`h-px w-5 rounded-full ${tone.line}`} aria-hidden />
            <p className={`text-[11px] font-bold uppercase tracking-[0.22em] ${tone.eyebrow}`}>{eyebrow}</p>
          </div>
        )}
        <h2 className="text-lg font-black">{title}</h2>
        {values.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {values.map((value) => (
              <span key={value} className={`rounded-full border px-3 py-1 text-sm font-medium ${tone.chipBorder} ${tone.chipText}`}>
                {value}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">{fallback}</p>
        )}
      </div>
    </div>
  );
}

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

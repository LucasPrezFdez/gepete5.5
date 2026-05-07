import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameGrid } from "@/components/games/GameGrid";
import { ListCard } from "@/components/lists/ListCard";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { UserProfileHeader } from "@/components/users/UserProfileHeader";
import { communityLists } from "@/data/community";
import { getExploreGames } from "@/services/games";
import { getPublicUserProfile } from "@/services/users";

type Params = Promise<{ username: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `Perfil de @${username}`,
    description: `Actividad, listas, reseñas y backlog de @${username} en GameIndex.`
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Media" value={profile.stats.averageScore ? String(profile.stats.averageScore) : "—"} />
        <Stat label="Valoraciones" value={String(profile.stats.ratingsCount)} />
        <Stat label="Completados" value={String(profile.stats.completedCount)} />
        <Stat label="Backlog" value={String(profile.stats.backlogCount)} />
        <Stat label="Seguidores" value={String(profile.stats.followerCount)} />
        <Stat label="Siguiendo" value={String(profile.stats.followingCount)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PreferenceCard title="Plataformas favoritas" values={profile.profile.favoritePlatforms} fallback="Aún no ha elegido plataformas favoritas." />
        <PreferenceCard title="Géneros favoritos" values={profile.profile.favoriteGenres} fallback="Aún no ha elegido géneros favoritos." />
      </div>

      <div>
        <SectionHeader title="Actividad reciente" />
        {profile.activity.length ? (
          <div className="space-y-3">
            {profile.activity.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                <span className="text-foreground">{event.message}</span> · {formatDate(event.createdAt)}
              </div>
            ))}
          </div>
        ) : (
          <EmptyProfileSection title="Sin actividad pública todavía" description="Cuando publique reseñas, cree listas o actualice su biblioteca, aparecerá aquí." />
        )}
      </div>

      <div>
        <SectionHeader title="Listas públicas" />
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
        <SectionHeader title="Reseñas recientes" />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card rounded-2xl p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function PreferenceCard({ title, values, fallback }: { title: string; values: string[]; fallback: string }) {
  return (
    <div className="surface-card rounded-2xl p-5">
      <h2 className="font-bold">{title}</h2>
      {values.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => <span key={value} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-muted">{value}</span>)}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{fallback}</p>
      )}
    </div>
  );
}

function EmptyProfileSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
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

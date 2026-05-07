import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameGrid } from "@/components/games/GameGrid";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { communityLists } from "@/data/community";
import { getExploreGames } from "@/services/games";
import { createServiceDatabaseClient } from "@/services/database";
import { listFromRow } from "@/services/lists";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const list = await getDatabaseList(slug);
  const fallback = communityLists.find((item) => item.slug === slug);
  return {
    title: list?.title ?? fallback?.title ?? "Lista",
    description: list?.description ?? fallback?.description
  };
}

export default async function ListPage({ params }: { params: Params }) {
  const { slug } = await params;
  const list = await getDatabaseList(slug);

  if (list) {
    return (
      <section className="container-page py-10">
        <div className="surface-card mb-8 rounded-3xl p-8">
          <Badge tone={list.isPublic ? "violet" : "muted"}>{list.isPublic ? "Lista pública" : "Lista privada"}</Badge>
          <h1 className="mt-4 text-4xl font-black">{list.title}</h1>
          <p className="mt-2 text-sm text-muted">por @{list.user.username}</p>
          {list.description && <p className="mt-3 max-w-2xl text-muted">{list.description}</p>}
          <div className="mt-6 flex gap-3">
            <Button>Me gusta ({list.likesCount.toLocaleString("es-ES")})</Button>
            <Button variant="secondary">Guardar lista</Button>
          </div>
        </div>
        <SectionHeader title="Juegos de la lista" />
        {list.items.length > 0 ? (
          <GameGrid games={list.items.map((item: any) => item.game)} view="list" />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-muted">Esta lista todavía no tiene juegos.</div>
        )}
      </section>
    );
  }

  const fallback = communityLists.find((item) => item.slug === slug);
  if (!fallback) notFound();

  const gameResults = await Promise.all(fallback.games.map((title) => getExploreGames({ query: title, pageSize: 1 })));
  const games = gameResults.flatMap((result) => result.games.slice(0, 1));
  const apiErrors = gameResults.map((result) => result.error).filter(Boolean);

  return (
    <section className="container-page py-10">
      <div className="surface-card mb-8 rounded-3xl p-8">
        <Badge tone="violet">Lista pública</Badge>
        <h1 className="mt-4 text-4xl font-black">{fallback.title}</h1>
        <p className="mt-3 max-w-2xl text-muted">{fallback.description}</p>
        <div className="mt-6 flex gap-3">
          <Button>Me gusta</Button>
          <Button variant="secondary">Guardar lista</Button>
        </div>
      </div>
      <SectionHeader title="Juegos de la lista" />
      {apiErrors[0] && <p className="mb-5 text-sm text-danger">{apiErrors[0]}</p>}
      <GameGrid games={games} />
      <p className="mt-8 text-sm text-muted">Lista editorial inicial; las listas nuevas se cargan desde Neon.</p>
    </section>
  );
}

async function getDatabaseList(slug: string) {
  try {
    const serviceClient = createServiceDatabaseClient();
    const { data, error } = await serviceClient
      .from("lists")
      .select("*, profiles:user_id(id,username,display_name,bio,avatar_url,created_at), list_items(position,note,games(slug,title,summary,release_year,status,cover_url,hero_url,user_score,critic_score,rating_count,review_count))")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;
    return listFromRow(data);
  } catch {
    return null;
  }
}




import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GameAdminActions } from "@/components/admin/games/GameAdminActions";
import { createSqlClient } from "@/services/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export default async function AdminGameDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!slug?.trim()) notFound();

  const sql = createSqlClient();
  const rows = (await sql.query(
    `select id, slug, title, summary, cover_url, hero_url, status, user_score, critic_score,
            rating_count, review_count, popularity_score, last_synced_at, release_year,
            is_featured, featured_rank, is_hidden, hidden_reason
     from games where slug = $1 limit 1`,
    [slug]
  )) as Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    cover_url: string | null;
    hero_url: string | null;
    status: string | null;
    user_score: number | null;
    critic_score: number | null;
    rating_count: number | null;
    review_count: number | null;
    popularity_score: number | null;
    last_synced_at: string | null;
    release_year: number | null;
    is_featured: boolean;
    featured_rank: number | null;
    is_hidden: boolean;
    hidden_reason: string | null;
  }>;

  if (!rows.length) notFound();
  const game = rows[0];

  const sources = (await sql.query(
    "select provider, external_id, synced_at from external_sources where game_id = $1 order by synced_at desc nulls last",
    [game.id]
  )) as Array<{ provider: string; external_id: string; synced_at: string | null }>;

  return (
    <>
      <AdminPageHeader
        title={game.title}
        description={game.slug}
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Catálogo", href: "/admin/games" },
          { label: game.slug }
        ]}
        actions={
          <Link
            href={`/games/${encodeURIComponent(game.slug)}`}
            className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-muted hover:border-white/[0.18] hover:text-foreground"
          >
            Ver ficha pública →
          </Link>
        }
      />

      <section className="mb-6 grid gap-6 sm:grid-cols-[180px_1fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
          {game.cover_url ? (
            <Image
              src={game.cover_url}
              alt=""
              width={180}
              height={240}
              className="h-auto w-full rounded-lg object-cover"
            />
          ) : (
            <div className="aspect-[3/4] w-full rounded-lg bg-white/[0.04] text-center text-[11px] text-muted">
              <span className="block pt-20">Sin portada</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {game.is_featured && (
              <span className="rounded bg-[#A3E635]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#A3E635]">
                Destacado{game.featured_rank ? ` #${game.featured_rank}` : ""}
              </span>
            )}
            {game.is_hidden && (
              <span className="rounded bg-danger/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-danger">
                Oculto
              </span>
            )}
            {game.status && (
              <span className="rounded bg-white/[0.06] px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                {game.status}
              </span>
            )}
            {game.release_year ? (
              <span className="rounded bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-muted">
                {game.release_year}
              </span>
            ) : null}
          </div>
          {game.summary && <p className="text-[14px] leading-6 text-muted">{game.summary}</p>}
          <dl className="grid gap-3 sm:grid-cols-2 text-[12.5px]">
            <Field label="Score usuarios" value={game.user_score !== null ? Number(game.user_score).toFixed(1) : "—"} />
            <Field label="Score críticos" value={game.critic_score !== null ? String(game.critic_score) : "—"} />
            <Field label="Reseñas" value={(game.review_count ?? 0).toLocaleString("es-ES")} />
            <Field label="Valoraciones" value={(game.rating_count ?? 0).toLocaleString("es-ES")} />
          </dl>
          {sources.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Fuentes externas</p>
              <ul className="mt-1 flex flex-wrap gap-2 text-[12px]">
                {sources.map((row) => (
                  <li
                    key={`${row.provider}-${row.external_id}`}
                    className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-muted"
                  >
                    <span className="font-bold uppercase tracking-wider">{row.provider}</span>
                    <span className="ml-1 font-mono">#{row.external_id}</span>
                    {row.synced_at && <span className="ml-2 text-[11px]">{new Date(row.synced_at).toLocaleDateString("es-ES")}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <GameAdminActions
        slug={game.slug}
        initial={{
          isFeatured: game.is_featured,
          featuredRank: game.featured_rank,
          isHidden: game.is_hidden,
          hiddenReason: game.hidden_reason
        }}
        lastSyncedAt={game.last_synced_at}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-[13px] text-foreground">{value}</dd>
    </div>
  );
}

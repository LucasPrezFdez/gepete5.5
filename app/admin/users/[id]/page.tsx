import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { createSqlClient } from "@/services/database";
import { isEmailAdmin } from "@/services/auth";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminUserDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const sql = createSqlClient();
  const userRows = (await sql.query(
    `select p.id,
            coalesce(u.email, p.username || '@mock.gameindex.local') as email,
            p.username,
            p.display_name,
            p.created_at,
            p.updated_at,
     from profiles p
     left join app_users u on u.id = p.id
     where p.id = $1
     limit 1`,
    [id],
  )) as Array<{
    id: string;
    email: string;
    username: string;
    display_name: string | null;
    created_at: string;
    updated_at: string;
  }>;

  if (!userRows.length) notFound();
  const user = userRows[0];
  const hasAccount = !user.email.endsWith("@mock.gameindex.local");
  const isAdmin = isEmailAdmin(user.email);

  const [
    reviewsCount,
    listsCount,
    ratingsCount,
    reportsAgainst,
    reportsBy,
    recentReviews,
    recentLists,
  ] = await Promise.all([
    sql.query("select count(*)::int as n from reviews where user_id = $1", [
      id,
    ]),
    sql.query("select count(*)::int as n from lists where user_id = $1", [id]),
    sql.query("select count(*)::int as n from ratings where user_id = $1", [
      id,
    ]),
    sql.query(
      `select count(*)::int as n from content_reports
       where (target_type = 'profile' and target_id = $1)
          or (target_type = 'review' and target_id in (select id from reviews where user_id = $1))
          or (target_type = 'list' and target_id in (select id from lists where user_id = $1))
          or (target_type = 'comment' and target_id in (select id from ratings where user_id = $1))`,
      [id],
    ),
    sql.query(
      "select count(*)::int as n from content_reports where reporter_user_id = $1",
      [id],
    ),
    sql.query(
      `select id, title, score, created_at, hidden_at, game_id,
              (select slug from games where id = reviews.game_id) as game_slug,
              (select title from games where id = reviews.game_id) as game_title
       from reviews where user_id = $1 order by created_at desc limit 5`,
      [id],
    ),
    sql.query(
      `select id, slug, title, likes_count, created_at, hidden_at, is_public
       from lists where user_id = $1 order by created_at desc limit 5`,
      [id],
    ),
  ]);

  const counts = {
    reviews: (reviewsCount as any[])[0]?.n ?? 0,
    lists: (listsCount as any[])[0]?.n ?? 0,
    comments: (ratingsCount as any[])[0]?.n ?? 0,
    reportsReceived: (reportsAgainst as any[])[0]?.n ?? 0,
    reportsSubmitted: (reportsBy as any[])[0]?.n ?? 0,
  };

  return (
    <>
      <AdminPageHeader
        title={user.display_name ?? user.username}
        description={user.email}
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Usuarios", href: "/admin/users" },
          { label: `@${user.username}` },
        ]}
        actions={null}
      />

      <section className="mb-6 flex flex-wrap items-center gap-2">
        {isAdmin && (
          <span className="rounded-md bg-[#A3E635]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#A3E635]">
            Admin
          </span>
        )}
        <span className="rounded-md bg-white/[0.04] px-2 py-1 text-[11px] font-mono text-muted">
          Alta:{" "}
          {new Date(user.created_at).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </section>

      <p className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12.5px] text-muted">
        El estado de administrador se controla mediante la variable{" "}
        <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">
          ADMIN_EMAILS
        </code>
        . No hay UI para promover ni degradar admins desde aquí.
      </p>

      {!hasAccount && (
        <p className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12.5px] text-muted">
          Este perfil existe en la base pública, pero no tiene una cuenta
          autenticable en{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">
            app_users
          </code>
          .
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Reseñas" value={counts.reviews} />
        <StatCard label="Listas" value={counts.lists} />
        <StatCard label="Valoraciones" value={counts.comments} />
        <StatCard
          label="Reportes contra"
          value={counts.reportsReceived}
          tone={counts.reportsReceived > 0 ? "warn" : "default"}
        />
        <StatCard label="Reportes hechos" value={counts.reportsSubmitted} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-3 text-base font-semibold tracking-tight">
            Reseñas recientes
          </h2>
          {(recentReviews as any[]).length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center text-[13px] text-muted">
              Sin reseñas publicadas.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(recentReviews as any[]).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[13px]"
                >
                  <Link
                    href={
                      row.game_slug ? `/games/${row.game_slug}/reviews` : "#"
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 hover:text-foreground"
                  >
                    <span className="truncate font-medium">{row.title}</span>
                    {row.game_title && (
                      <span className="truncate text-[11px] text-muted">
                        — {row.game_title}
                      </span>
                    )}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-[11px]">
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono">
                      {row.score}/10
                    </span>
                    {row.hidden_at && (
                      <span className="rounded bg-danger/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-danger">
                        Oculto
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-3 text-base font-semibold tracking-tight">
            Listas recientes
          </h2>
          {(recentLists as any[]).length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center text-[13px] text-muted">
              Sin listas creadas.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(recentLists as any[]).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[13px]"
                >
                  <Link
                    href={`/lists/${encodeURIComponent(row.slug)}`}
                    className="flex min-w-0 flex-1 items-center gap-2 hover:text-foreground"
                  >
                    <span className="truncate font-medium">{row.title}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-[11px]">
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono">
                      {Number(row.likes_count ?? 0).toLocaleString("es-ES")} ♥
                    </span>
                    {!row.is_public && (
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-bold uppercase tracking-wider text-muted">
                        Privada
                      </span>
                    )}
                    {row.hidden_at && (
                      <span className="rounded bg-danger/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-danger">
                        Oculta
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

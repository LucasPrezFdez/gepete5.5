import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReportActions } from "@/components/admin/reports/ReportActions";
import { createSqlClient } from "@/services/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REASON_LABEL: Record<string, string> = {
  spam: "Spam o publicidad",
  harassment: "Acoso o insultos",
  spoiler: "Spoilers no marcados",
  offensive: "Contenido ofensivo",
  inaccurate: "Información incorrecta",
  other: "Otro motivo"
};

const TARGET_LABEL: Record<string, string> = {
  review: "Reseña",
  list: "Lista",
  profile: "Perfil",
  comment: "Comentario",
  game: "Juego"
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  resolved: "Resuelto",
  dismissed: "Descartado"
};

export default async function AdminReportDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const sql = createSqlClient();
  const rows = (await sql.query(
    `select id, reporter_user_id, target_type, target_id, reason, details, status,
            resolved_by, resolved_at, resolution_note, created_at
     from content_reports where id = $1 limit 1`,
    [id]
  )) as Array<{
    id: string;
    reporter_user_id: string | null;
    target_type: string;
    target_id: string;
    reason: string;
    details: string | null;
    status: string;
    resolved_by: string | null;
    resolved_at: string | null;
    resolution_note: string | null;
    created_at: string;
  }>;
  if (!rows.length) notFound();
  const report = rows[0];

  const reporter = report.reporter_user_id ? await loadUser(sql, report.reporter_user_id) : null;
  const resolver = report.resolved_by ? await loadUser(sql, report.resolved_by) : null;
  const target = await loadTarget(sql, report.target_type, report.target_id);

  return (
    <>
      <AdminPageHeader
        title={REASON_LABEL[report.reason] ?? report.reason}
        description={`Reporte sobre ${(TARGET_LABEL[report.target_type] ?? report.target_type).toLowerCase()}`}
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Moderación", href: "/admin/reports" },
          { label: report.id.slice(0, 8) }
        ]}
        actions={
          report.status === "pending" ? (
            <ReportActions
              reportId={report.id}
              targetType={report.target_type as any}
              alreadyHidden={Boolean(target?.hidden)}
            />
          ) : null
        }
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Estado">
          <span
            className={
              report.status === "pending"
                ? "text-[#A3E635]"
                : report.status === "resolved"
                ? "text-electric"
                : "text-muted"
            }
          >
            {STATUS_LABEL[report.status] ?? report.status}
          </span>
        </Field>
        <Field label="Tipo">{TARGET_LABEL[report.target_type] ?? report.target_type}</Field>
        <Field label="Reporter">
          {reporter ? (
            <Link href={`/admin/users/${reporter.id}`} className="text-foreground hover:text-electric">
              @{reporter.username}
            </Link>
          ) : (
            <span className="italic text-muted/60">anónimo</span>
          )}
        </Field>
        <Field label="Creado">
          <time dateTime={report.created_at} title={report.created_at} className="font-mono text-[12px]">
            {new Date(report.created_at).toLocaleString("es-ES")}
          </time>
        </Field>
      </section>

      {report.details && (
        <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Comentario del reporter
          </h2>
          <p className="whitespace-pre-line text-[14px] text-foreground">{report.details}</p>
        </section>
      )}

      {report.status !== "pending" && (
        <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Resolución</h2>
          <p className="text-[13px] text-muted">
            {STATUS_LABEL[report.status]} por{" "}
            {resolver ? (
              <Link href={`/admin/users/${resolver.id}`} className="text-foreground hover:text-electric">
                @{resolver.username}
              </Link>
            ) : (
              "un admin"
            )}
            {report.resolved_at && (
              <>
                {" "}
                el{" "}
                <time dateTime={report.resolved_at} className="font-mono">
                  {new Date(report.resolved_at).toLocaleString("es-ES")}
                </time>
              </>
            )}
            .
          </p>
          {report.resolution_note && (
            <p className="mt-2 whitespace-pre-line rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[13px] text-foreground">
              {report.resolution_note}
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Contenido reportado</h2>
          {target?.hidden && (
            <span className="rounded bg-danger/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-danger">
              Oculto
            </span>
          )}
        </header>
        <TargetPreview target={target} type={report.target_type} />
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="mt-1 text-[13.5px] font-semibold text-foreground">{children}</div>
    </div>
  );
}

type TargetData = Awaited<ReturnType<typeof loadTarget>>;

function TargetPreview({ target, type }: { target: TargetData; type: string }) {
  if (!target) {
    return (
      <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center text-[13px] text-muted">
        El contenido reportado ya no existe.
      </p>
    );
  }

  const authorBlock = target.author && (
    <p className="mb-3 text-[12px] text-muted">
      por{" "}
      <Link href={`/admin/users/${target.author.id}`} className="font-semibold text-foreground hover:text-electric">
        @{target.author.username}
      </Link>
    </p>
  );

  if (type === "review") {
    return (
      <>
        {authorBlock}
        <h3 className="text-lg font-bold text-foreground">{target.title}</h3>
        {target.gameTitle && <p className="mt-0.5 text-[12px] text-muted">{target.gameTitle}</p>}
        <p className="mt-3 whitespace-pre-line text-[14px] leading-6 text-muted">{target.body}</p>
        <p className="mt-3 text-[12px] text-muted">
          Nota: <span className="font-mono text-foreground">{target.score}/10</span>
          {target.hasSpoilers && <span className="ml-2 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">Spoilers</span>}
        </p>
      </>
    );
  }

  if (type === "list") {
    return (
      <>
        {authorBlock}
        <h3 className="text-lg font-bold text-foreground">{target.title}</h3>
        {target.description && (
          <p className="mt-3 whitespace-pre-line text-[14px] leading-6 text-muted">{target.description}</p>
        )}
        <Link
          href={`/lists/${encodeURIComponent(target.slug ?? "")}`}
          className="mt-3 inline-flex text-[12px] font-semibold text-electric hover:underline"
        >
          Abrir lista pública →
        </Link>
      </>
    );
  }

  if (type === "comment") {
    return (
      <>
        {authorBlock}
        {target.gameTitle && <p className="mb-1 text-[12px] text-muted">{target.gameTitle}</p>}
        <p className="text-[14px] leading-6 text-foreground">{target.body ?? <span className="italic text-muted">Sin texto</span>}</p>
        {typeof target.score === "number" && (
          <p className="mt-2 text-[12px] text-muted">Nota: <span className="font-mono text-foreground">{target.score}/10</span></p>
        )}
      </>
    );
  }

  if (type === "profile") {
    return (
      <>
        <p className="text-[14px]">
          <Link href={`/admin/users/${target.author?.id}`} className="font-semibold text-foreground hover:text-electric">
            @{target.author?.username}
          </Link>{" "}
          <span className="text-muted">— {target.author?.displayName}</span>
        </p>
        {target.bio && <p className="mt-3 whitespace-pre-line text-[13.5px] text-muted">{target.bio}</p>}
        {target.isBanned && (
          <p className="mt-3 text-[12px] text-danger">
            Cuenta ya suspendida {target.bannedUntil ? `hasta ${new Date(target.bannedUntil).toLocaleString("es-ES")}` : "(permanente)"}.
          </p>
        )}
      </>
    );
  }

  if (type === "game") {
    return (
      <>
        <h3 className="text-lg font-bold text-foreground">{target.title}</h3>
        {target.summary && <p className="mt-3 text-[14px] leading-6 text-muted">{target.summary}</p>}
        {target.slug && (
          <Link
            href={`/games/${target.slug}`}
            className="mt-3 inline-flex text-[12px] font-semibold text-electric hover:underline"
          >
            Abrir ficha pública →
          </Link>
        )}
      </>
    );
  }

  return null;
}

async function loadUser(sql: ReturnType<typeof createSqlClient>, id: string) {
  const rows = (await sql.query(
    "select id, username, display_name from app_users where id = $1 limit 1",
    [id]
  )) as Array<{ id: string; username: string; display_name: string | null }>;
  if (!rows.length) return null;
  return { id: rows[0].id, username: rows[0].username, displayName: rows[0].display_name ?? rows[0].username };
}

async function loadTarget(sql: ReturnType<typeof createSqlClient>, type: string, targetId: string) {
  if (type === "review") {
    const rows = (await sql.query(
      `select r.id, r.user_id, r.title, r.body, r.score, r.has_spoilers, r.hidden_at, r.created_at,
              g.slug as game_slug, g.title as game_title
       from reviews r left join games g on g.id = r.game_id
       where r.id = $1 limit 1`,
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    const author = rows[0].user_id ? await loadUser(sql, rows[0].user_id) : null;
    return {
      author,
      hidden: Boolean(rows[0].hidden_at),
      title: rows[0].title as string,
      body: rows[0].body as string,
      score: rows[0].score as number,
      hasSpoilers: Boolean(rows[0].has_spoilers),
      gameSlug: rows[0].game_slug as string | null,
      gameTitle: rows[0].game_title as string | null,
      slug: null as string | null,
      description: null as string | null,
      bio: null as string | null,
      bannedUntil: null as string | null,
      isBanned: false,
      summary: null as string | null
    };
  }

  if (type === "list") {
    const rows = (await sql.query(
      "select id, user_id, slug, title, description, hidden_at from lists where id = $1 limit 1",
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    const author = rows[0].user_id ? await loadUser(sql, rows[0].user_id) : null;
    return {
      author,
      hidden: Boolean(rows[0].hidden_at),
      title: rows[0].title as string,
      slug: rows[0].slug as string,
      description: rows[0].description as string | null,
      body: null as string | null,
      score: null as number | null,
      hasSpoilers: false,
      gameSlug: null,
      gameTitle: null,
      bio: null,
      bannedUntil: null,
      isBanned: false,
      summary: null
    };
  }

  if (type === "comment") {
    const rows = (await sql.query(
      `select r.id, r.user_id, r.score, r.comment_body, r.hidden_at,
              g.slug as game_slug, g.title as game_title
       from ratings r left join games g on g.id = r.game_id
       where r.id = $1 limit 1`,
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    const author = rows[0].user_id ? await loadUser(sql, rows[0].user_id) : null;
    return {
      author,
      hidden: Boolean(rows[0].hidden_at),
      body: rows[0].comment_body as string | null,
      score: rows[0].score as number,
      gameSlug: rows[0].game_slug as string | null,
      gameTitle: rows[0].game_title as string | null,
      title: null as string | null,
      hasSpoilers: false,
      slug: null,
      description: null,
      bio: null,
      bannedUntil: null,
      isBanned: false,
      summary: null
    };
  }

  if (type === "profile") {
    const rows = (await sql.query(
      `select p.id, p.username, p.display_name, p.bio,
              u.banned_at, u.banned_until
       from profiles p left join app_users u on u.id = p.id
       where p.id = $1 limit 1`,
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    return {
      author: { id: rows[0].id, username: rows[0].username, displayName: rows[0].display_name ?? rows[0].username },
      hidden: false,
      bio: rows[0].bio as string | null,
      bannedUntil: rows[0].banned_until as string | null,
      isBanned: Boolean(rows[0].banned_at),
      title: null,
      body: null,
      score: null,
      hasSpoilers: false,
      gameSlug: null,
      gameTitle: null,
      slug: null,
      description: null,
      summary: null
    };
  }

  if (type === "game") {
    const rows = (await sql.query(
      "select id, slug, title, summary, is_hidden from games where id = $1 limit 1",
      [targetId]
    )) as Array<any>;
    if (!rows.length) return null;
    return {
      author: null,
      hidden: Boolean(rows[0].is_hidden),
      title: rows[0].title as string,
      summary: rows[0].summary as string | null,
      slug: rows[0].slug as string,
      body: null,
      score: null,
      hasSpoilers: false,
      gameSlug: null,
      gameTitle: null,
      description: null,
      bio: null,
      bannedUntil: null,
      isBanned: false
    };
  }

  return null;
}

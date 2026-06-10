import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SeedFallbackUsersButton } from "@/components/admin/users/SeedFallbackUsersButton";
import {
  Table,
  TableEmptyState,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { createSqlClient } from "@/services/database";
import { listAdminDirectoryUsers } from "@/services/users";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; filter?: string; page?: string }>;

const PAGE_SIZE = 25;
const FILTER_LABEL: Record<string, string> = {
  all: "Todos",
  banned: "Solo baneados",
  admins: "Solo admins",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, filter, page } = await searchParams;
  const queryText = (q ?? "").trim();
  const filterValue = filter && FILTER_LABEL[filter] ? filter : "all";
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const sql = createSqlClient();
  const {
    users,
    count: total,
    pageSize,
  } = await listAdminDirectoryUsers({
    query: queryText || undefined,
    filter: filterValue as "all" | "banned" | "admins",
    page: pageNumber,
    pageSize: PAGE_SIZE,
  });

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const ids = users
    .map((u) => u.profile.id)
    .filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      ),
    );
  let reviewCounts = new Map<string, number>();
  if (ids.length) {
    try {
      const counts = (await sql.query(
        "select user_id, count(*)::int as n from reviews where user_id = any($1::uuid[]) group by user_id",
        [ids],
      )) as Array<{ user_id: string; n: number }>;
      reviewCounts = new Map(counts.map((row) => [row.user_id, row.n]));
    } catch (error) {
      console.error("Error fetching review counts:", error);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Usuarios"
        description={`${total.toLocaleString("es-ES")} cuentas en total. Busca, filtra y entra al detalle para banear o ver actividad.`}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Usuarios" }]}
        actions={<SeedFallbackUsersButton />}
      />

      <form
        method="GET"
        className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]"
      >
        <input
          type="search"
          name="q"
          defaultValue={queryText}
          placeholder="Buscar por email, username o nombre..."
          className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
        />
        <select
          name="filter"
          defaultValue={filterValue}
          className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-foreground focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
        >
          {Object.entries(FILTER_LABEL).map(([value, label]) => (
            <option
              key={value}
              value={value}
              className="bg-[#0b0f1a] text-foreground"
            >
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-electric px-4 text-[13px] font-semibold text-white hover:bg-electric/90"
        >
          Filtrar
        </button>
      </form>

      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>Usuario</TH>
              <TH>Email</TH>
              <TH className="hidden sm:table-cell">Alta</TH>
              <TH className="hidden md:table-cell">Reseñas</TH>
              <TH>Estado</TH>
              <TH className="text-right">Acción</TH>
            </tr>
          </THead>
          <TBody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <TableEmptyState
                    title="Sin resultados"
                    description="Prueba a quitar filtros o cambiar la búsqueda."
                  />
                </td>
              </tr>
            ) : (
              users.map((user) => {
                return (
                  <TR key={user.profile.id}>
                    <TD>
                      <Link
                        href={`/admin/users/${user.profile.id}`}
                        className="block font-semibold text-foreground hover:text-electric"
                      >
                        {user.profile.displayName ?? user.profile.username}
                      </Link>
                      <span className="text-[11.5px] text-muted">
                        @{user.profile.username}
                      </span>
                    </TD>
                    <TD className="font-mono text-[12px] text-muted">
                      {user.account?.email ??
                        `${user.profile.username}@mock.gameindex.local`}
                      {!user.account && (
                        <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                          Sin cuenta
                        </span>
                      )}
                    </TD>
                    <TD className="hidden sm:table-cell font-mono text-[11.5px] text-muted">
                      {formatDate(user.profile.createdAt)}
                    </TD>
                    <TD className="hidden md:table-cell tabular-nums">
                      {(reviewCounts.get(user.profile.id) ?? 0).toLocaleString(
                        "es-ES",
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {user.account?.isAdmin && (
                          <span className="rounded bg-[#A3E635]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A3E635]">
                            Admin
                          </span>
                        )}
                        {!user.account?.isAdmin ? (
                          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                            Activo
                          </span>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/admin/users/${user.profile.id}`}
                        className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-muted hover:border-white/[0.18] hover:text-foreground"
                      >
                        Ver →
                      </Link>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>

      <Pagination
        page={pageNumber}
        pages={pages}
        query={queryText}
        filter={filterValue}
      />
    </>
  );
}

type PaginationProps = {
  page: number;
  pages: number;
  query: string;
  filter: string;
};

function Pagination({ page, pages, query, filter }: PaginationProps) {
  if (pages <= 1) return null;
  return (
    <nav
      className="mt-4 flex items-center justify-between gap-3 text-[12.5px] text-muted"
      aria-label="Paginación"
    >
      <span className="font-mono">
        Página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <PageLink
          page={Math.max(1, page - 1)}
          label="← Anterior"
          disabled={page <= 1}
          query={query}
          filter={filter}
        />
        <PageLink
          page={Math.min(pages, page + 1)}
          label="Siguiente →"
          disabled={page >= pages}
          query={query}
          filter={filter}
        />
      </div>
    </nav>
  );
}

type PageLinkProps = {
  page: number;
  label: string;
  disabled?: boolean;
  query: string;
  filter: string;
};

function PageLink({ page, label, disabled, query, filter }: PageLinkProps) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter && filter !== "all") params.set("filter", filter);
  params.set("page", String(page));
  const href = `/admin/users?${params.toString()}`;
  if (disabled) {
    return (
      <span className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-1.5 opacity-40">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 hover:border-white/[0.18] hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

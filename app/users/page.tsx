import type { Metadata } from "next";
import Link from "next/link";
import { UserDirectoryControls } from "@/components/users/UserDirectoryControls";
import { UserDirectoryCard } from "@/components/users/UserDirectoryCard";
import { listPublicUsers, type DirectorySort } from "@/services/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Usuarios — GameIndex",
  description: "Descubre a la comunidad de GameIndex: perfiles, plataformas favoritas, valoraciones y listas curadas."
};

const VALID_SORTS: DirectorySort[] = ["followers", "ratings", "completed", "alphabetical"];

type SearchParams = Promise<{
  q?: string;
  sort?: string;
  page?: string;
}>;

export default async function UsersDirectoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, sort, page } = await searchParams;
  const safeSort: DirectorySort = (VALID_SORTS as string[]).includes(sort ?? "") ? (sort as DirectorySort) : "followers";
  const safePage = Number(page) > 0 ? Number(page) : 1;

  const result = await listPublicUsers({
    query: q?.trim() || undefined,
    sort: safeSort,
    page: safePage,
    pageSize: 24
  });

  const totalPages = Math.max(1, Math.ceil(result.count / result.pageSize));

  return (
    <section className="container-page space-y-8 py-10">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-electric">Comunidad</p>
        <h1 className="text-3xl font-black md:text-4xl">Usuarios de GameIndex</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted md:text-base">
          Descubre perfiles con listas, reseñas y backlogs. Filtra por nombre o usuario y ordena por seguidores, valoraciones o juegos completados.
        </p>
      </header>

      <UserDirectoryControls initialQuery={q ?? ""} initialSort={safeSort} totalCount={result.count} />

      {result.users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-12 text-center">
          <h2 className="text-lg font-black">Sin resultados</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            No hemos encontrado usuarios para esta búsqueda. Prueba con otro término o cambia la ordenación.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.users.map((user) => (
            <UserDirectoryCard key={user.profile.id} user={user} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={result.page} totalPages={totalPages} query={q} sort={safeSort} />
      )}
    </section>
  );
}

function Pagination({
  currentPage,
  totalPages,
  query,
  sort
}: {
  currentPage: number;
  totalPages: number;
  query?: string;
  sort: DirectorySort;
}) {
  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "followers") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `/users?${search}` : "/users";
  };

  const previousHref = currentPage > 1 ? buildHref(currentPage - 1) : null;
  const nextHref = currentPage < totalPages ? buildHref(currentPage + 1) : null;

  return (
    <nav className="flex items-center justify-between gap-3 border-t border-white/10 pt-6" aria-label="Paginación">
      {previousHref ? (
        <Link
          href={previousHref}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:border-electric/45 hover:bg-white/10"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2 text-sm text-muted/60">
          ← Anterior
        </span>
      )}

      <span className="text-xs uppercase tracking-wider text-muted">
        Página {currentPage} de {totalPages}
      </span>

      {nextHref ? (
        <Link
          href={nextHref}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:border-electric/45 hover:bg-white/10"
        >
          Siguiente →
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2 text-sm text-muted/60">
          Siguiente →
        </span>
      )}
    </nav>
  );
}

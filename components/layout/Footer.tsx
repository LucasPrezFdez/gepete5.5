import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 py-10">
      <div className="container-page flex flex-col gap-4 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p>? 2026 GameIndex. Cat?logo, reseñas y listas de videojuegos.</p>
        <nav className="flex gap-4" aria-label="Footer">
          <Link href="/games" className="hover:text-foreground">
            Explorar
          </Link>
          <Link href="/rankings/top-250" className="hover:text-foreground">
            Top 250
          </Link>
          <Link href="/users/norapixel" className="hover:text-foreground">
            Comunidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}


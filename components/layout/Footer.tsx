import Link from "next/link";

const footerNav = {
  explorar: [
    { href: "/games", label: "Explorar juegos" },
    { href: "/rankings", label: "Rankings" },
    { href: "/rankings/top-250", label: "Top 250" },
    { href: "/rankings/upcoming", label: "Próximos lanzamientos" },
    { href: "/rankings/reviewed", label: "Más reseñados" }
  ],
  comunidad: [
    { href: "/me/library", label: "Mi biblioteca" },
    { href: "/auth", label: "Iniciar sesión" },
    { href: "/auth?mode=signup", label: "Crear cuenta" }
  ]
};

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="relative mt-20 overflow-hidden">
      {/* Top gradient separator */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.25) 35%, rgba(139,92,246,0.25) 65%, transparent)" }}
      />
      <div className="absolute inset-x-0 top-0 border-t border-white/[0.05]" />

      {/* Subtle background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(59,130,246,0.04) 0%, transparent 70%)" }}
      />

      <div className="container-page relative py-14 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">

          {/* Brand column */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="group flex w-fit items-center font-black tracking-tight">
              <span className="text-[16.5px] tracking-[-0.01em] motion-safe:transition-opacity motion-safe:duration-200 group-hover:opacity-80">GameIndex</span>
            </Link>
            <p className="max-w-[270px] text-sm leading-relaxed text-muted/80">
              Tu base de datos de videojuegos. Descubre, valora y organiza con rankings, reseñas y listas de comunidad.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-2">
              {[
                { href: "https://twitter.com", label: "Twitter / X", Icon: XIcon },
                { href: "https://discord.com", label: "Discord", Icon: DiscordIcon },
                { href: "https://github.com", label: "GitHub", Icon: GitHubIcon }
              ].map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-muted/60 motion-safe:transition-all motion-safe:duration-150 hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-foreground"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Explorar column */}
          <div>
            <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted/50">
              Explorar
            </p>
            <ul className="grid gap-2.5">
              {footerNav.explorar.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted/75 motion-safe:transition-colors motion-safe:duration-150 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Comunidad column */}
          <div>
            <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted/50">
              Cuenta
            </p>
            <ul className="grid gap-2.5">
              {footerNav.comunidad.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted/75 motion-safe:transition-colors motion-safe:duration-150 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-white/[0.05] pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted/40">
            © 2026 GameIndex. Todos los derechos reservados.
          </p>
          <p className="text-xs text-muted/30">
            Datos de <span className="text-muted/50">IGDB</span> &amp; <span className="text-muted/50">RAWG</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

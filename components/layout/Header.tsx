"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthSession } from "@/services/auth-types";
import { GameSearchBar } from "@/components/games/GameSearchBar";
import { Button } from "@/components/ui/Button";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { cn } from "@/lib/utils";
import { createBrowserAuthClient } from "@/services/auth-browser";

const navItems = [
  { href: "/games", label: "Juegos" },
  { href: "/rankings", label: "Rankings" },
  { href: "/rankings/top-250", label: "Top 250" }
];

function isNavActive(pathname: string, href: string) {
  if (href === "/games") return pathname === "/games" || pathname.startsWith("/games/");
  return pathname === href;
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const profileHref = username ? `/users/${username}` : "/me";
  const isProfileActive = pathname === profileHref || pathname === "/me" || (username !== null && pathname === `/users/${username}`);
  const isLibraryActive = pathname === "/me/library";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    let authClient: ReturnType<typeof createBrowserAuthClient>;
    try {
      authClient = createBrowserAuthClient();
    } catch {
      return () => { mounted = false; };
    }

    async function load(nextSession: AuthSession | null) {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession?.user) { setUsername(null); return; }
      const response = await fetch("/api/me/profile", {
        headers: { Authorization: `Bearer ${nextSession.access_token}` }
      }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) : null;
      if (mounted) setUsername(data?.profile?.username ?? nextSession.user.user_metadata?.username ?? null);
    }

    authClient.auth.getSession().then(({ data }) => load(data.session));
    const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, nextSession) => load(nextSession));
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    try {
      const authClient = createBrowserAuthClient();
      await authClient.auth.signOut();
      window.location.href = "/";
    } catch { /* no-op */ }
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 motion-safe:transition-all motion-safe:duration-300",
        scrolled
          ? "border-b border-white/[0.08] bg-background/96 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_1px_0_rgba(59,130,246,0.07)]"
          : "border-b border-white/[0.04] bg-background/75 backdrop-blur-xl"
      )}
    >
      {/* Gradient accent line at top */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px motion-safe:transition-opacity motion-safe:duration-500",
          scrolled ? "opacity-60" : "opacity-30"
        )}
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.7) 40%, rgba(139,92,246,0.7) 60%, transparent)" }}
      />

      <div className="container-page flex h-16 items-center gap-5 lg:h-[68px]">

        {/* Logo */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 font-black tracking-tight"
        >
          <span className="text-[16.5px] tracking-[-0.01em] motion-safe:transition-opacity motion-safe:duration-200 group-hover:opacity-80">
            GameIndex
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-lg px-3.5 py-2 text-[13.5px] font-medium motion-safe:transition-all motion-safe:duration-150",
                  active
                    ? "bg-white/[0.09] text-foreground"
                    : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                )}
              >
                {active && (
                  <span
                    className="absolute inset-x-3.5 bottom-[3px] h-px"
                    style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.7), rgba(139,92,246,0.7))" }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Search bar */}
        <div className="ml-auto hidden w-full max-w-[320px] md:block lg:max-w-[380px]">
          <GameSearchBar compact />
        </div>

        {/* Auth area */}
        <div className="hidden items-center gap-1.5 md:flex">
          {session ? (
            <>
              <NotificationsBell session={session} />
              <Button variant={isProfileActive ? "secondary" : "ghost"} size="sm" asChild href={profileHref}>
                Mi perfil
              </Button>
              <Button variant={isLibraryActive ? "secondary" : "ghost"} size="sm" asChild href="/me/library">
                Mi biblioteca
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Salir
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild href="/auth">
                Entrar
              </Button>
              <Button size="sm" asChild href="/auth?mode=signup">
                Crear cuenta
              </Button>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button
          className={cn(
            "ml-auto flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg border motion-safe:transition-all motion-safe:duration-200 md:hidden",
            open
              ? "border-white/[0.15] bg-white/[0.08]"
              : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06]"
          )}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <span
            className={cn(
              "h-px w-[15px] rounded-full bg-foreground/75 origin-center motion-safe:transition-all motion-safe:duration-300",
              open ? "translate-y-[6px] rotate-45" : ""
            )}
          />
          <span
            className={cn(
              "h-px w-[15px] rounded-full bg-foreground/75 motion-safe:transition-all motion-safe:duration-200",
              open ? "opacity-0 scale-x-0" : ""
            )}
          />
          <span
            className={cn(
              "h-px w-[15px] rounded-full bg-foreground/75 origin-center motion-safe:transition-all motion-safe:duration-300",
              open ? "-translate-y-[6px] -rotate-45" : ""
            )}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-nav"
        className={cn(
          "overflow-hidden md:hidden motion-safe:transition-[max-height,opacity] motion-safe:duration-300 motion-safe:ease-in-out",
          open ? "max-h-[540px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="container-page grid gap-3 pb-5 pt-2">
          <GameSearchBar compact />
          <div className="h-px bg-white/[0.05]" />
          <nav className="grid gap-0.5" aria-label="Principal móvil">
            {navItems.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-150",
                    active
                      ? "bg-white/[0.09] text-foreground"
                      : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                  )}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="h-px bg-white/[0.05]" />
          <div className="grid gap-0.5">
            {session ? (
              <>
                <Link
                  href={profileHref}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-150",
                    isProfileActive ? "bg-white/[0.09] text-foreground" : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                  )}
                  onClick={() => setOpen(false)}
                >
                  Mi perfil
                </Link>
                <Link
                  href="/me/library"
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium motion-safe:transition-colors motion-safe:duration-150",
                    isLibraryActive ? "bg-white/[0.09] text-foreground" : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                  )}
                  onClick={() => setOpen(false)}
                >
                  Mi biblioteca
                </Link>
                <button
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted motion-safe:transition-colors motion-safe:duration-150 hover:bg-white/[0.06] hover:text-foreground"
                  onClick={() => { setOpen(false); signOut(); }}
                >
                  Salir
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/auth"
                  className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-muted motion-safe:transition-colors motion-safe:duration-150 hover:bg-white/[0.06] hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Entrar
                </Link>
                <Link
                  href="/auth?mode=signup"
                  className="rounded-lg py-2.5 text-center text-sm font-semibold text-white motion-safe:transition-opacity motion-safe:duration-150 hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
                  onClick={() => setOpen(false)}
                >
                  Crear cuenta
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

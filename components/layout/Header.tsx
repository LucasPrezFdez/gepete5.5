"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthSession } from "@/services/auth-types";
import { GameSearchBar } from "@/components/games/GameSearchBar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { createBrowserAuthClient } from "@/services/auth-browser";

const navItems = [
  { href: "/games", label: "Juegos" },
  { href: "/rankings", label: "Rankings" },
  { href: "/rankings/top-250", label: "Top 250" }
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const profileHref = username ? `/users/${username}` : "/users/me";
  const isProfileActive = pathname === profileHref;
  const isLibraryActive = pathname === "/me/library";

  useEffect(() => {
    let mounted = true;
    let authClient: ReturnType<typeof createBrowserAuthClient>;
    try {
      authClient = createBrowserAuthClient();
    } catch {
      return () => {
        mounted = false;
      };
    }

    async function load(nextSession: AuthSession | null) {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setUsername(null);
        return;
      }
      const response = await fetch("/api/me/profile", {
        headers: {
          Authorization: `Bearer ${nextSession.access_token}`
        }
      }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) : null;
      if (mounted) setUsername(data?.profile?.username ?? nextSession.user.user_metadata?.username ?? null);
    }

    authClient.auth.getSession().then(({ data }) => load(data.session));
    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, nextSession) => load(nextSession));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    try {
      const authClient = createBrowserAuthClient();
      await authClient.auth.signOut();
      window.location.href = "/";
    } catch {
      // no-op
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-20 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-electric to-violet text-sm shadow-glow">GI</span>
          <span className="text-lg">GameIndex</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden w-full max-w-md md:block">
          <GameSearchBar compact />
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              <Button variant={isProfileActive ? "secondary" : "ghost"} size="sm" asChild href={profileHref}>Mi perfil</Button>
              <Button variant={isLibraryActive ? "secondary" : "ghost"} size="sm" asChild href="/me/library">Mi biblioteca</Button>
              <Button variant="ghost" size="sm" onClick={signOut}>Salir</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild href="/auth">Entrar</Button>
              <Button size="sm" asChild href="/auth?mode=signup">Crear cuenta</Button>
            </>
          )}
        </div>

        <button className="ml-auto rounded-xl border border-white/10 px-3 py-2 text-sm md:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-nav">
          Menú
        </button>
      </div>

      <div id="mobile-nav" className={cn("container-page grid gap-4 overflow-hidden transition-all md:hidden", open ? "max-h-[520px] pb-5" : "max-h-0")}>
        <GameSearchBar compact />
        <nav className="grid gap-1" aria-label="Principal móvil">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground" onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          {session ? (
            <>
              <Link href={profileHref} className={cn("rounded-xl px-3 py-2 text-sm hover:bg-white/10 hover:text-foreground", isProfileActive ? "bg-white/10 text-foreground" : "text-muted")} onClick={() => setOpen(false)}>Mi perfil</Link>
              <Link href="/me/library" className={cn("rounded-xl px-3 py-2 text-sm hover:bg-white/10 hover:text-foreground", isLibraryActive ? "bg-white/10 text-foreground" : "text-muted")} onClick={() => setOpen(false)}>Mi biblioteca</Link>
            </>
          ) : (
            <Link href="/auth" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-foreground" onClick={() => setOpen(false)}>Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}



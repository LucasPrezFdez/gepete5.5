"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Game, UserGameStatus } from "@/data/games";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createBrowserAuthClient } from "@/services/auth-browser";

const labels: Record<UserGameStatus, string> = {
  want_to_play: "Pendientes",
  playing: "Jugando",
  completed: "Completados",
  dropped: "Abandonados",
  paused: "Pausados",
  favorite: "Favoritos"
};

export default function LibraryPage() {
  const [items, setItems] = useState<Array<{ status: UserGameStatus; createdAt: string; game: Game | null }>>([]);
  const [activeStatus, setActiveStatus] = useState<UserGameStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const authClient = createBrowserAuthClient();
        const { data } = await authClient.auth.getSession();
        if (!data.session?.access_token) {
          setError("Inicia sesión para ver tu biblioteca.");
          return;
        }
        const response = await fetch("/api/me/library", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store"
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "No se pudo cargar la biblioteca.");
        setItems(payload.statuses ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filtered = useMemo(() => (activeStatus === "all" ? items : items.filter((item) => item.status === activeStatus)), [activeStatus, items]);
  const counts = useMemo(() => {
    const map = new Map<UserGameStatus, number>();
    for (const item of items) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [items]);

  return (
    <section className="container-page py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">Biblioteca personal</p>
        <h1 className="text-4xl font-black">Mi biblioteca</h1>
        <p className="mt-3 max-w-2xl text-muted">Organiza pendientes, juegos en curso, completados y favoritos desde cada ficha de juego.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button variant={activeStatus === "all" ? "primary" : "secondary"} onClick={() => setActiveStatus("all")}>Todo ({items.length})</Button>
        {(Object.keys(labels) as UserGameStatus[]).map((status) => (
          <Button key={status} variant={activeStatus === status ? "primary" : "secondary"} onClick={() => setActiveStatus(status)}>
            {labels[status]} ({counts.get(status) ?? 0})
          </Button>
        ))}
      </div>

      {loading && <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">Cargando biblioteca...</div>}
      {error && <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">{error}</div>}
      {!loading && !error && filtered.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-muted">No hay juegos en esta sección todavía.</div>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => item.game && (
          <Link key={`${item.status}-${item.game.slug}`} href={`/games/${item.game.slug}`} className="surface-card rounded-2xl p-5 transition hover:-translate-y-1 hover:border-electric/45">
            <Badge tone={item.status === "favorite" ? "lime" : "violet"}>{labels[item.status]}</Badge>
            <h2 className="mt-3 text-xl font-black">{item.game.title}</h2>
            <p className="mt-1 text-sm text-muted">Añadido el {new Intl.DateTimeFormat("es").format(new Date(item.createdAt))}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}



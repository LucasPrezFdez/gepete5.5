"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/feedback/Toast";
import { useAuthSession } from "@/hooks/useAuthSession";

type Props = {
  slug: string;
  initial: {
    isFeatured: boolean;
    featuredRank: number | null;
    isHidden: boolean;
    hiddenReason: string | null;
  };
  lastSyncedAt: string | null;
};

export function GameAdminActions({ slug, initial, lastSyncedAt }: Props) {
  const router = useRouter();
  const { accessToken } = useAuthSession();
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured);
  const [featuredRank, setFeaturedRank] = useState<string>(
    initial.featuredRank !== null ? String(initial.featuredRank) : ""
  );
  const [isHidden, setIsHidden] = useState(initial.isHidden);
  const [hiddenReason, setHiddenReason] = useState(initial.hiddenReason ?? "");
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [currentSync, setCurrentSync] = useState(lastSyncedAt);
  const [resyncedSource, setResyncedSource] = useState<string | null>(null);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const rankNumber = featuredRank.trim() ? Number(featuredRank.trim()) : undefined;
      const payload = {
        isFeatured,
        featuredRank: Number.isFinite(rankNumber as number) ? rankNumber : (isFeatured ? null : undefined),
        isHidden,
        hiddenReason: isHidden ? hiddenReason.trim() || undefined : ""
      };
      const response = await fetch(`/api/admin/games/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        toast({ tone: "error", title: "No se pudo guardar", description: result?.error });
        return;
      }
      toast({ tone: "success", title: "Overrides guardados" });
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Error de conexión", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function handleResync() {
    if (resyncing) return;
    setResyncing(true);
    setResyncedSource(null);
    try {
      const response = await fetch(`/api/admin/games/${encodeURIComponent(slug)}/resync`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        toast({ tone: "error", title: "No se pudo resincronizar", description: result?.error });
        return;
      }
      setCurrentSync(result?.lastSyncedAt ?? new Date().toISOString());
      setResyncedSource(result?.source ?? null);
      toast({
        tone: "success",
        title: "Juego resincronizado",
        description: result?.source ? `Fuente: ${result.source.toUpperCase()}` : undefined
      });
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Error de conexión", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setResyncing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleSave} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Overrides</h2>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </header>

        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(event) => setIsFeatured(event.target.checked)}
            className="accent-[#A3E635]"
          />
          <span className="font-medium">Destacar este juego</span>
        </label>

        <label className="mb-4 block space-y-1.5">
          <span className="text-[12.5px] text-muted">Orden de destacado (opcional)</span>
          <input
            type="number"
            value={featuredRank}
            onChange={(event) => setFeaturedRank(event.target.value)}
            disabled={!isFeatured}
            min={0}
            max={9999}
            placeholder="0 = primero"
            className="block w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30 disabled:opacity-50"
          />
        </label>

        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={isHidden}
            onChange={(event) => setIsHidden(event.target.checked)}
            className="accent-danger"
          />
          <span className="font-medium">Ocultar del catálogo público</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[12.5px] text-muted">Motivo del ocultado (opcional)</span>
          <textarea
            value={hiddenReason}
            onChange={(event) => setHiddenReason(event.target.value.slice(0, 240))}
            disabled={!isHidden}
            rows={2}
            placeholder="Solo lo verán otros admins."
            className="block w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30 disabled:opacity-50"
          />
          <span className="block text-right text-[11px] text-muted">{hiddenReason.length}/240</span>
        </label>
      </form>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Caché</h2>
          <Button type="button" size="sm" variant="secondary" onClick={handleResync} disabled={resyncing}>
            {resyncing ? "Resincronizando..." : "Resync ahora"}
          </Button>
        </header>
        <dl className="grid gap-3 text-[13px]">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Último sync</dt>
            <dd className="mt-1 font-mono text-foreground">
              {currentSync ? new Date(currentSync).toLocaleString("es-ES") : "nunca"}
            </dd>
          </div>
          {resyncedSource && (
            <p className="rounded-lg border border-[#A3E635]/30 bg-[#A3E635]/10 px-3 py-2 text-[12.5px] text-[#A3E635]">
              Resincronizado desde <strong>{resyncedSource.toUpperCase()}</strong>.
            </p>
          )}
          <p className="text-[12px] text-muted">
            El resync fuerza una llamada nueva a IGDB (o RAWG como fallback) y actualiza score, portada, plataformas y géneros.
          </p>
        </dl>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { toast } from "@/components/feedback/Toast";
import { useAuthSession } from "@/hooks/useAuthSession";

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  isBanned: boolean;
  publicProfileHref: string | null;
};

const DURATIONS: Array<{ value: number | "permanent"; label: string }> = [
  { value: 24, label: "24 horas" },
  { value: 24 * 7, label: "7 días" },
  { value: 24 * 30, label: "30 días" },
  { value: "permanent", label: "Permanente" }
];

export function UserAdminActions({ userId, username, isAdmin, isBanned, publicProfileHref }: Props) {
  const router = useRouter();
  const { accessToken } = useAuthSession();
  const [banOpen, setBanOpen] = useState(false);
  const [unbanning, setUnbanning] = useState(false);
  const [banDuration, setBanDuration] = useState<number | "permanent">(24 * 7);
  const [banReason, setBanReason] = useState("");
  const [banSubmitting, setBanSubmitting] = useState(false);

  async function submitBan(event: React.FormEvent) {
    event.preventDefault();
    if (banSubmitting) return;
    setBanSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          action: "ban",
          reason: banReason.trim() || undefined,
          durationHours: banDuration === "permanent" ? undefined : banDuration
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast({ tone: "error", title: "No se pudo banear", description: payload?.error });
        return;
      }
      toast({
        tone: "success",
        title: `@${username} suspendido`,
        description: payload?.banned?.until
          ? `Hasta ${new Date(payload.banned.until).toLocaleString()}`
          : "Suspensión permanente"
      });
      setBanOpen(false);
      setBanReason("");
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Error de conexión", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBanSubmitting(false);
    }
  }

  async function handleUnban() {
    if (unbanning) return;
    setUnbanning(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ action: "unban" })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast({ tone: "error", title: "No se pudo levantar la suspensión", description: payload?.error });
        return;
      }
      toast({ tone: "success", title: `@${username} restaurado` });
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Error de conexión", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setUnbanning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isBanned ? (
        <Button type="button" variant="secondary" size="sm" onClick={handleUnban} disabled={unbanning}>
          {unbanning ? "Restaurando..." : "Levantar suspensión"}
        </Button>
      ) : (
        <Button type="button" variant="danger" size="sm" onClick={() => setBanOpen(true)} disabled={isAdmin}>
          Suspender
        </Button>
      )}
      {publicProfileHref && (
        <Button type="button" variant="ghost" size="sm" asChild href={publicProfileHref}>
          Ver perfil público
        </Button>
      )}

      <Dialog
        open={banOpen}
        onClose={() => (banSubmitting ? null : setBanOpen(false))}
        title={`Suspender a @${username}`}
        description="El usuario no podrá iniciar sesión hasta que termine la suspensión."
        size="md"
      >
        <form onSubmit={submitBan} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-foreground">Duración</legend>
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map((option) => (
                <label
                  key={String(option.value)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                    banDuration === option.value
                      ? "border-danger/40 bg-danger/10 text-foreground"
                      : "border-white/[0.06] bg-white/[0.02] text-muted hover:text-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="ban-duration"
                    checked={banDuration === option.value}
                    onChange={() => setBanDuration(option.value)}
                    className="accent-danger"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground">Motivo (opcional)</span>
            <textarea
              value={banReason}
              onChange={(event) => setBanReason(event.target.value.slice(0, 240))}
              rows={3}
              placeholder="Anota el motivo. Lo verá el equipo de moderación."
              className="block w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
            />
            <span className="block text-right text-[11px] text-muted">{banReason.length}/240</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setBanOpen(false)} disabled={banSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" size="sm" disabled={banSubmitting}>
              {banSubmitting ? "Suspendiendo..." : "Suspender"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}

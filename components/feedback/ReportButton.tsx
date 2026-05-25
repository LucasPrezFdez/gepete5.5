"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { toast } from "@/components/feedback/Toast";
import { useAuthSession } from "@/hooks/useAuthSession";
import { cn } from "@/lib/utils";

export type ReportTargetType = "review" | "list" | "profile" | "comment" | "game";

type ReportButtonProps = {
  targetType: ReportTargetType;
  targetId: string;
  authorId?: string | null;
  label?: string;
  className?: string;
  variant?: "ghost" | "secondary";
  size?: "sm" | "md";
};

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam o publicidad" },
  { value: "harassment", label: "Acoso o insultos" },
  { value: "spoiler", label: "Spoilers no marcados" },
  { value: "offensive", label: "Contenido ofensivo" },
  { value: "inaccurate", label: "Información incorrecta" },
  { value: "other", label: "Otro motivo" }
];

const TARGET_LABEL: Record<ReportTargetType, string> = {
  review: "esta reseña",
  list: "esta lista",
  profile: "este perfil",
  comment: "este comentario",
  game: "este juego"
};

export function ReportButton({
  targetType,
  targetId,
  authorId,
  label = "Reportar",
  className,
  variant = "ghost",
  size = "sm"
}: ReportButtonProps) {
  const { session, accessToken, isAdmin } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASON_OPTIONS[0].value);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!session?.user) return null;
  if (isAdmin) return null;
  if (authorId && authorId === session.user.id) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          details: details.trim() || undefined
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast({
          tone: "error",
          title: "No se pudo enviar el reporte",
          description: payload?.error ?? "Inténtalo de nuevo en un momento."
        });
        return;
      }
      toast({
        tone: "success",
        title: payload?.already ? "Ya habías reportado este contenido" : "Reporte enviado",
        description: payload?.already
          ? "Nuestro equipo lo revisará pronto."
          : "Gracias por avisar. Lo revisaremos cuanto antes."
      });
      setOpen(false);
      setDetails("");
      setReason(REASON_OPTIONS[0].value);
    } catch (error) {
      toast({
        tone: "error",
        title: "Error de conexión",
        description: error instanceof Error ? error.message : "Inténtalo de nuevo."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg text-[12px] font-medium text-muted hover:text-foreground motion-safe:transition-colors",
          size === "sm" ? "px-2 py-1" : "px-3 py-1.5 text-sm",
          variant === "secondary" && "border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
          className
        )}
        aria-label={`Reportar ${TARGET_LABEL[targetType]}`}
      >
        <FlagIcon className="h-3.5 w-3.5" />
        {label}
      </button>

      <Dialog
        open={open}
        onClose={() => (submitting ? null : setOpen(false))}
        title={`Reportar ${TARGET_LABEL[targetType]}`}
        description="Cuéntanos qué pasa. Solo el equipo de moderación verá tu reporte."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-foreground">Motivo</legend>
            <div className="grid gap-1.5">
              {REASON_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[13px] motion-safe:transition-colors",
                    reason === option.value
                      ? "border-electric/40 bg-electric/10 text-foreground"
                      : "border-white/[0.06] bg-white/[0.02] text-muted hover:border-white/[0.12] hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    className="accent-electric"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground">Detalles (opcional)</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, 500))}
              rows={3}
              placeholder="Añade contexto si crees que ayuda."
              className="block w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
            />
            <span className="block text-right text-[11px] text-muted">{details.length}/500</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar reporte"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 21V4" />
      <path d="M4 4h12l-2 4 2 4H4" />
    </svg>
  );
}

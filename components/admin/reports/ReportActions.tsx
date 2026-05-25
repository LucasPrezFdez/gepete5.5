"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { toast } from "@/components/feedback/Toast";
import { useAuthSession } from "@/hooks/useAuthSession";
import { cn } from "@/lib/utils";

type ReportTargetType = "review" | "list" | "profile" | "comment" | "game";

type Props = {
  reportId: string;
  targetType: ReportTargetType;
  alreadyHidden: boolean;
};

type Action = "dismiss" | "resolve-only" | "resolve-hide" | "resolve-hide-ban";

const BAN_DURATIONS: Array<{ value: number | "permanent"; label: string }> = [
  { value: 24, label: "24 horas" },
  { value: 24 * 7, label: "7 días" },
  { value: 24 * 30, label: "30 días" },
  { value: "permanent", label: "Permanente" }
];

export function ReportActions({ reportId, targetType, alreadyHidden }: Props) {
  const router = useRouter();
  const { accessToken } = useAuthSession();
  const [dialogAction, setDialogAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [banDuration, setBanDuration] = useState<number | "permanent">(24 * 7);
  const [submitting, setSubmitting] = useState(false);

  const canHide = targetType === "review" || targetType === "list" || targetType === "comment";

  async function submit(action: Action) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        action: action === "dismiss" ? "dismiss" : "resolve"
      };
      if (action === "resolve-hide" || action === "resolve-hide-ban") {
        payload.hideContent = true;
      }
      if (action === "resolve-hide-ban") {
        payload.banAuthor = true;
        if (banDuration !== "permanent") {
          payload.banDurationHours = banDuration;
        }
      }
      if (reason.trim()) payload.reason = reason.trim();
      if (note.trim()) payload.resolutionNote = note.trim();

      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        toast({ tone: "error", title: "No se pudo procesar el reporte", description: result?.error });
        return;
      }
      toast({
        tone: "success",
        title:
          action === "dismiss"
            ? "Reporte descartado"
            : action === "resolve-hide-ban"
            ? "Contenido oculto y autor suspendido"
            : action === "resolve-hide"
            ? "Contenido oculto"
            : "Reporte resuelto"
      });
      setDialogAction(null);
      setReason("");
      setNote("");
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Error de conexión", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setDialogAction("dismiss")}>
          Descartar
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setDialogAction("resolve-only")}>
          Resolver sin acción
        </Button>
        {canHide && !alreadyHidden && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setDialogAction("resolve-hide")}>
            Ocultar contenido
          </Button>
        )}
        {canHide && (
          <Button type="button" variant="danger" size="sm" onClick={() => setDialogAction("resolve-hide-ban")}>
            Ocultar y banear autor
          </Button>
        )}
      </div>

      <Dialog
        open={dialogAction !== null}
        onClose={() => (submitting ? null : setDialogAction(null))}
        title={DIALOG_TITLE[dialogAction ?? "dismiss"]}
        description={DIALOG_DESCRIPTION[dialogAction ?? "dismiss"]}
        size="md"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (dialogAction) submit(dialogAction);
          }}
          className="space-y-4"
        >
          {(dialogAction === "resolve-hide" || dialogAction === "resolve-hide-ban") && (
            <label className="block space-y-1.5">
              <span className="text-[13px] font-semibold text-foreground">Motivo del ocultado</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 240))}
                rows={2}
                placeholder="Se guardará junto al contenido oculto."
                className="block w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
              />
              <span className="block text-right text-[11px] text-muted">{reason.length}/240</span>
            </label>
          )}

          {dialogAction === "resolve-hide-ban" && (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-semibold text-foreground">Duración del baneo</legend>
              <div className="grid grid-cols-2 gap-2">
                {BAN_DURATIONS.map((option) => (
                  <label
                    key={String(option.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]",
                      banDuration === option.value
                        ? "border-danger/40 bg-danger/10 text-foreground"
                        : "border-white/[0.06] bg-white/[0.02] text-muted hover:text-foreground"
                    )}
                  >
                    <input
                      type="radio"
                      checked={banDuration === option.value}
                      onChange={() => setBanDuration(option.value)}
                      className="accent-danger"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground">Nota interna (opcional)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
              rows={2}
              placeholder="Solo la verá el equipo de moderación."
              className="block w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-muted/60 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/30"
            />
            <span className="block text-right text-[11px] text-muted">{note.length}/500</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDialogAction(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={dialogAction === "resolve-hide-ban" || dialogAction === "resolve-hide" ? "danger" : "primary"}
              disabled={submitting}
            >
              {submitting ? "Aplicando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

const DIALOG_TITLE: Record<Action, string> = {
  "dismiss": "Descartar reporte",
  "resolve-only": "Resolver sin acción",
  "resolve-hide": "Ocultar contenido",
  "resolve-hide-ban": "Ocultar contenido y banear autor"
};

const DIALOG_DESCRIPTION: Record<Action, string> = {
  "dismiss": "Marca el reporte como descartado. No se toma ninguna otra acción.",
  "resolve-only": "Cierra el reporte sin ocultar el contenido. Útil cuando ya se resolvió por otra vía.",
  "resolve-hide": "El contenido pasará a estado oculto. El autor podrá ver un placeholder; el resto de usuarios no lo verá.",
  "resolve-hide-ban":
    "Oculta el contenido y suspende al autor durante el periodo indicado. Acción reversible desde el detalle del usuario."
};

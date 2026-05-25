"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/feedback/Toast";
import { useAuthSession } from "@/hooks/useAuthSession";

type JobState = {
  id: string;
  type: "backfill_covers" | "bulk_resync";
  status: "pending" | "running" | "done" | "error";
  progress: number;
  total: number | null;
  errorMessage: string | null;
};

type Props = {
  defaultLimit?: number;
};

const POLL_INTERVAL_MS = 3000;
const LIMIT_OPTIONS = [50, 100, 250, 500];

export function CacheActions({ defaultLimit = 100 }: Props) {
  const router = useRouter();
  const { accessToken } = useAuthSession();
  const [limit, setLimit] = useState(defaultLimit);
  const [activeJob, setActiveJob] = useState<JobState | null>(null);
  const [launching, setLaunching] = useState<"backfill_covers" | "bulk_resync" | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  async function launch(type: "backfill_covers" | "bulk_resync") {
    if (launching || (activeJob && activeJob.status !== "done" && activeJob.status !== "error")) return;
    setLaunching(type);
    try {
      const endpoint = type === "backfill_covers" ? "/api/admin/cache/backfill-covers" : "/api/admin/cache/bulk-resync";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ limit })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        toast({ tone: "error", title: "No se pudo lanzar el job", description: result?.error });
        return;
      }
      toast({ tone: "success", title: type === "backfill_covers" ? "Backfill iniciado" : "Resync masivo iniciado" });
      setActiveJob({ id: result.jobId, type, status: "pending", progress: 0, total: null, errorMessage: null });
      pollJob(result.jobId);
    } catch (error) {
      toast({ tone: "error", title: "Error de conexión", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLaunching(null);
    }
  }

  async function pollJob(jobId: string) {
    try {
      const response = await fetch(`/api/admin/jobs/${jobId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.job) {
        const job = result.job as JobState;
        setActiveJob(job);
        if (job.status === "done") {
          toast({ tone: "success", title: "Job completado", description: `${job.progress} elementos procesados` });
          router.refresh();
          return;
        }
        if (job.status === "error") {
          toast({ tone: "error", title: "Job con errores", description: job.errorMessage ?? undefined });
          return;
        }
      }
    } catch {
      /* swallow polling errors, próxima iteración reintenta */
    }
    pollTimeoutRef.current = setTimeout(() => pollJob(jobId), POLL_INTERVAL_MS);
  }

  const isRunning = activeJob && (activeJob.status === "pending" || activeJob.status === "running");
  const percent =
    activeJob && activeJob.total && activeJob.total > 0
      ? Math.min(100, Math.round((activeJob.progress / activeJob.total) * 100))
      : null;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">Acciones masivas</h2>
        <select
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          disabled={Boolean(isRunning)}
          className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-foreground"
        >
          {LIMIT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              Procesar {value} juegos
            </option>
          ))}
        </select>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => launch("bulk_resync")}
          disabled={Boolean(launching || isRunning)}
        >
          {launching === "bulk_resync" ? "Iniciando..." : "Refrescar juegos antiguos"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => launch("backfill_covers")}
          disabled={Boolean(launching || isRunning)}
        >
          {launching === "backfill_covers" ? "Iniciando..." : "Backfill de portadas"}
        </Button>
      </div>

      {activeJob && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[12.5px] text-muted">
            <span className="font-mono">{activeJob.type}</span> · estado{" "}
            <span
              className={
                activeJob.status === "done"
                  ? "text-[#A3E635]"
                  : activeJob.status === "error"
                  ? "text-danger"
                  : "text-electric"
              }
            >
              {activeJob.status}
            </span>
          </p>
          {(activeJob.status === "running" || activeJob.status === "pending") && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full bg-electric motion-safe:transition-all"
                style={{ width: `${percent ?? 5}%` }}
              />
            </div>
          )}
          <p className="mt-2 font-mono text-[11.5px] text-muted">
            {activeJob.progress.toLocaleString("es-ES")}
            {activeJob.total !== null ? ` / ${activeJob.total.toLocaleString("es-ES")}` : ""}{" "}
            {percent !== null && <span>· {percent}%</span>}
          </p>
          {activeJob.errorMessage && (
            <p className="mt-2 text-[12px] text-danger">{activeJob.errorMessage}</p>
          )}
        </div>
      )}

      <p className="mt-3 text-[11.5px] text-muted">
        Los jobs se ejecutan en background. Puedes seguir navegando; el progreso se actualiza cada 3 segundos.
      </p>
    </section>
  );
}

import { cn } from "@/lib/utils";

export type HealthStatus = "ok" | "warn" | "down" | "unknown";

type HealthBadgeProps = {
  label: string;
  status: HealthStatus;
  detail?: string;
  className?: string;
};

const STATUS_STYLE: Record<HealthStatus, { dot: string; text: string; border: string; copy: string }> = {
  ok: { dot: "bg-[#A3E635]", text: "text-[#A3E635]", border: "border-[#A3E635]/30", copy: "OK" },
  warn: { dot: "bg-amber-400", text: "text-amber-300", border: "border-amber-400/30", copy: "WARN" },
  down: { dot: "bg-danger", text: "text-danger", border: "border-danger/40", copy: "DOWN" },
  unknown: { dot: "bg-muted", text: "text-muted", border: "border-white/[0.08]", copy: "n/d" }
};

export function HealthBadge({ label, status, detail, className }: HealthBadgeProps) {
  const style = STATUS_STYLE[status];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border bg-white/[0.02] px-3 py-2 text-[12.5px]",
        style.border,
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden />
      <span className="font-semibold text-foreground">{label}</span>
      <span className={cn("text-[11px] font-bold uppercase tracking-wider", style.text)}>{style.copy}</span>
      {detail && <span className="ml-1 text-[11px] text-muted">{detail}</span>}
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "default" | "accent" | "warn" | "danger";
  className?: string;
};

const TONE_BORDER: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-white/[0.06]",
  accent: "border-[#A3E635]/30",
  warn: "border-amber-400/30",
  danger: "border-danger/40"
};

const TONE_VALUE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  accent: "text-[#A3E635]",
  warn: "text-amber-300",
  danger: "text-danger"
};

export function StatCard({ label, value, hint, href, tone = "default", className }: StatCardProps) {
  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cn("mt-2 text-3xl font-bold tracking-tight tabular-nums", TONE_VALUE[tone])}>
        {typeof value === "number" ? value.toLocaleString("es-ES") : value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </>
  );

  const baseClass = cn(
    "block rounded-2xl border bg-white/[0.02] p-5 motion-safe:transition-colors",
    TONE_BORDER[tone],
    href && "hover:border-white/[0.16] hover:bg-white/[0.04]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }
  return <div className={baseClass}>{content}</div>;
}

import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "blue" | "violet" | "lime" | "muted" | "danger";
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "default" && "border-white/10 bg-white/5 text-foreground",
        tone === "blue" && "border-electric/40 bg-electric/10 text-blue-200",
        tone === "violet" && "border-violet/40 bg-violet/10 text-violet-200",
        tone === "lime" && "border-lime/40 bg-lime/10 text-lime",
        tone === "muted" && "border-white/10 bg-white/5 text-muted",
        tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
        className
      )}
      {...props}
    />
  );
}

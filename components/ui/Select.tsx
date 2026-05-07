import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 rounded-xl border border-white/10 bg-surface px-4 text-sm text-foreground focus:border-electric",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

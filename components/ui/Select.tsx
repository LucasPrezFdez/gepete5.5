import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-foreground transition focus:border-electric",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

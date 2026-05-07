import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-foreground placeholder:text-muted transition focus:border-electric",
        className
      )}
      {...props}
    />
  );
}

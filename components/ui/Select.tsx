import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.06] pl-4 pr-9 text-sm text-foreground transition duration-150 focus:border-electric focus:bg-white/[0.09] focus:outline-none [&>option]:bg-background [&>option]:text-foreground"
        style={{ colorScheme: "dark" }}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted/50">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}

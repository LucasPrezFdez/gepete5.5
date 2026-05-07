import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
  href?: string;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild,
  href,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60",
    "focus-visible:ring-2 focus-visible:ring-electric",
    variant === "primary" &&
      "bg-electric text-white shadow-glow hover:bg-blue-500",
    variant === "secondary" &&
      "border border-white/10 bg-white/10 text-foreground hover:bg-white/15",
    variant === "ghost" && "text-muted hover:bg-white/10 hover:text-foreground",
    variant === "danger" && "bg-danger text-white hover:bg-rose-500",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-base",
    className
  );

  if (asChild && href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

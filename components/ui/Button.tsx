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
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
    "focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    variant === "primary" &&
      "bg-electric text-white hover:bg-electric/90 hover:shadow-[0_0_22px_rgba(59,130,246,0.4)]",
    variant === "secondary" &&
      "border border-white/10 bg-white/[0.07] text-foreground hover:bg-white/[0.12] hover:border-white/[0.18]",
    variant === "ghost" &&
      "text-muted hover:bg-white/[0.07] hover:text-foreground",
    variant === "danger" &&
      "bg-danger text-white hover:bg-danger/85 hover:shadow-[0_0_22px_rgba(244,63,94,0.35)]",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-10 px-4 text-sm",
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

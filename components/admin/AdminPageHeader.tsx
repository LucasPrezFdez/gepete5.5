import Link from "next/link";
import { cn } from "@/lib/utils";

type Crumb = { href?: string; label: string };

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
};

export function AdminPageHeader({ title, description, crumbs, actions, className }: AdminPageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div>
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-muted/80">
            {crumbs.map((crumb, idx) => (
              <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1">
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground">{crumb.label}</Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
                {idx < crumbs.length - 1 && <span aria-hidden>/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

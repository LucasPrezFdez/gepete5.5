import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type TableProps = React.TableHTMLAttributes<HTMLTableElement>;
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement>;
type RowProps = React.HTMLAttributes<HTMLTableRowElement>;
type CellProps = React.TdHTMLAttributes<HTMLTableCellElement>;
type HeaderCellProps = React.ThHTMLAttributes<HTMLTableCellElement>;

export function TableWrap({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]",
        className
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: TableProps) {
  return <table className={cn("w-full border-collapse text-[13px]", className)} {...props} />;
}

export function THead({ className, ...props }: SectionProps) {
  return (
    <thead
      className={cn(
        "border-b border-white/[0.06] bg-white/[0.02] text-[11px] uppercase tracking-[0.12em] text-muted",
        className
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: SectionProps) {
  return <tbody className={cn("divide-y divide-white/[0.04]", className)} {...props} />;
}

export function TR({ className, ...props }: RowProps) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-white/[0.025] focus-within:bg-white/[0.03]",
        className
      )}
      {...props}
    />
  );
}

export function TH({ className, ...props }: HeaderCellProps) {
  return (
    <th
      scope={props.scope ?? "col"}
      className={cn("px-4 py-3 text-left font-semibold text-muted", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: CellProps) {
  return <td className={cn("px-4 py-3 align-middle text-foreground", className)} {...props} />;
}

type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
};

export function TableEmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("border-t border-white/[0.04] px-4 py-10 text-center", className)}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-[12.5px] text-muted">{description}</p>}
    </div>
  );
}

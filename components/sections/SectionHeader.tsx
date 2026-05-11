import Link from "next/link";

export function SectionHeader({
  eyebrow,
  title,
  href
}: {
  eyebrow?: string;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-electric">
              {eyebrow}
            </p>
          </div>
        )}
        <h2 className="text-2xl font-black tracking-tight md:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-muted transition-colors duration-150 hover:text-foreground">
          Ver todo →
        </Link>
      )}
    </div>
  );
}

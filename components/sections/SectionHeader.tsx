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
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-black md:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-sm font-semibold text-electric hover:text-blue-300">
          Ver todo
        </Link>
      )}
    </div>
  );
}

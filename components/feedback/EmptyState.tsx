export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted/40">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

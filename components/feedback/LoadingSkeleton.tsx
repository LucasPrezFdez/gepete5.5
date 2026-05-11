export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/[0.06] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

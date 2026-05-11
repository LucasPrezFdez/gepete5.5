import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";

export default function GamesLoading() {
  return (
    <section className="container-page py-10">
      <div className="mb-8 space-y-3">
        <LoadingSkeleton className="h-6 w-40 rounded-lg" />
        <LoadingSkeleton className="h-10 w-72 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <LoadingSkeleton className="h-96 w-full rounded-2xl" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <LoadingSkeleton key={index} className="aspect-[3/4] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

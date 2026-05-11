import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";

export default function RootLoading() {
  return (
    <section className="container-page space-y-8 py-10">
      <LoadingSkeleton className="h-44 w-full rounded-3xl" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <LoadingSkeleton key={index} className="aspect-[3/4] w-full rounded-2xl" />
        ))}
      </div>
    </section>
  );
}

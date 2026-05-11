import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";

export default function UserLoading() {
  return (
    <section className="container-page space-y-10 py-10">
      <LoadingSkeleton className="h-60 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <LoadingSkeleton key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <LoadingSkeleton className="h-48 w-full rounded-2xl" />
    </section>
  );
}

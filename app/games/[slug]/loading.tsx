import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";

export default function GameDetailLoading() {
  return (
    <section className="container-page space-y-8 py-10">
      <LoadingSkeleton className="h-72 w-full rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <LoadingSkeleton className="aspect-video w-full rounded-2xl" />
        <div className="space-y-4">
          <LoadingSkeleton className="h-32 w-full rounded-2xl" />
          <LoadingSkeleton className="h-44 w-full rounded-2xl" />
          <LoadingSkeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </section>
  );
}

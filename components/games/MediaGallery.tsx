import Image from "next/image";
import { Game } from "@/data/games";

export function MediaGallery({ game }: { game: Game }) {
  const images = [game.heroUrl, game.coverUrl, game.heroUrl];

  return (
    <section className="grid gap-4">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        {game.trailerUrl ? (
          <iframe
            src={game.trailerUrl}
            title={`Trailer de ${game.title}`}
            className="aspect-video w-full"
            allowFullScreen
          />
        ) : (
          <div className="grid aspect-video place-items-center text-muted">
            Trailer no disponible
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {images.map((src, index) => (
          <div key={`${src}-${index}`} className="relative aspect-video overflow-hidden rounded-xl border border-white/10">
            <Image
              src={src}
              alt={`Captura ${index + 1} de ${game.title}`}
              fill
              className="object-cover"
              sizes="240px"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

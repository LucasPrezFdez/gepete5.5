"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Game } from "@/data/games";
import { cn } from "@/lib/utils";

type MediaScreenshot = { url: string; width?: number; height?: number };
type MediaVideo = { id: string; name: string };

type MediaItem =
  | { kind: "video"; id: string; label: string; thumbnail: string; src: string }
  | { kind: "image"; id: string; label: string; thumbnail: string };

export function MediaGallery({
  game,
  screenshots = [],
  videos = []
}: {
  game: Game;
  screenshots?: MediaScreenshot[];
  videos?: MediaVideo[];
}) {
  const items = useMemo<MediaItem[]>(() => {
    const list: MediaItem[] = [];

    videos.slice(0, 4).forEach((video, index) => {
      list.push({
        kind: "video",
        id: `video-${video.id}`,
        label: video.name || `Trailer ${index + 1}`,
        thumbnail: `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
        src: `https://www.youtube.com/embed/${video.id}`
      });
    });

    screenshots.slice(0, 12).forEach((screenshot, index) => {
      if (!screenshot.url) return;
      list.push({
        kind: "image",
        id: `screenshot-${index}`,
        label: `Captura ${index + 1}`,
        thumbnail: screenshot.url
      });
    });

    if (list.length === 0) {
      list.push({
        kind: "image",
        id: "hero",
        label: `Imagen principal de ${game.title}`,
        thumbnail: game.heroUrl ?? game.coverUrl
      });
    }

    return list;
  }, [screenshots, videos, game.title, game.heroUrl, game.coverUrl]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  const safeIndex = Math.min(activeIndex, items.length - 1);
  const active = items[safeIndex];
  const hasMultiple = items.length > 1;

  const goTo = useCallback(
    (next: number) => {
      if (items.length === 0) return;
      const wrapped = ((next % items.length) + items.length) % items.length;
      setActiveIndex(wrapped);
    },
    [items.length]
  );

  const goPrev = useCallback(() => goTo(safeIndex - 1), [goTo, safeIndex]);
  const goNext = useCallback(() => goTo(safeIndex + 1), [goTo, safeIndex]);

  return (
    <section
      className="grid gap-4"
      aria-roledescription="carrusel"
      aria-label={`Multimedia de ${game.title}`}
      onKeyDown={(event) => {
        if (!hasMultiple) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goNext();
        }
      }}
      tabIndex={hasMultiple ? 0 : -1}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        {active?.kind === "video" ? (
          <iframe
            key={active.id}
            src={active.src}
            title={active.label}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : active ? (
          <div className="relative aspect-video w-full">
            <Image
              src={active.thumbnail}
              alt={active.label}
              fill
              priority
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Anterior"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-200 hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Siguiente"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-200 hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronIcon direction="right" />
            </button>
            <span
              className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm"
              aria-live="polite"
            >
              {safeIndex + 1} / {items.length}
            </span>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Ver ${item.label}`}
              aria-current={index === safeIndex}
              className={cn(
                "group/thumb relative aspect-video overflow-hidden rounded-xl border motion-safe:transition-all motion-safe:duration-200",
                index === safeIndex
                  ? "border-electric/70 ring-2 ring-electric/40"
                  : "border-white/10 hover:border-white/25"
              )}
            >
              <Image
                src={item.thumbnail}
                alt=""
                fill
                sizes="240px"
                className="object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover/thumb:scale-[1.04]"
              />
              {item.kind === "video" && (
                <span
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 drop-shadow">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {direction === "left" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}

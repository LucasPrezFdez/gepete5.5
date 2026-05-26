"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Game } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { ReviewForm } from "@/components/reviews/ReviewForm";

export function ReviewComposer({ game }: { game: Game }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <section className="surface-card overflow-hidden rounded-3xl">
      {!open ? (
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-electric">Tu turno</p>
            </div>
            <h3 className="text-xl font-black md:text-2xl">¿Has jugado a {game.title}?</h3>
            <p className="mt-1 text-sm text-muted">
              Cuenta tu experiencia con una reseña larga. También puedes dejar solo una nota rápida desde la ficha del juego.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" onClick={() => setOpen(true)}>
              Dejar reseña
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-6 md:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-electric">Nueva reseña</p>
              </div>
              <h3 className="text-xl font-black md:text-2xl">Escribe tu reseña de {game.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/30 text-muted backdrop-blur transition hover:border-white/30 hover:bg-black/50 hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <ReviewForm
            game={game}
            onCancel={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </div>
      )}
    </section>
  );
}

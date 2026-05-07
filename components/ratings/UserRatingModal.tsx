"use client";

import { useState } from "react";
import type { Game } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { CommunityRatingForm } from "@/components/ratings/CommunityRatingForm";

export function UserRatingModal({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Valorar</Button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-elevated p-6 shadow-card">
            <h2 className="text-xl font-bold">Valora {game.title}</h2>
            <p className="mt-2 text-sm text-muted">
              Selecciona una puntuación de 1 a 10 y a?ade un comentario p?blico.
            </p>
            <div className="mt-6">
              <CommunityRatingForm game={game} compact onSaved={() => setOpen(false)} />
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



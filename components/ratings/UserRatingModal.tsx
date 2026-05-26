"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Game } from "@/data/games";
import { Button } from "@/components/ui/Button";
import { CommunityRatingForm } from "@/components/ratings/CommunityRatingForm";
import { buildAuthRedirectUrl, useAuthSession } from "@/hooks/useAuthSession";

export function UserRatingModal({ game }: { game: Game }) {
  const { isAuthenticated, isLoading } = useAuthSession();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <Button type="button" disabled>
        Valorar
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button asChild href={buildAuthRedirectUrl(`/games/${game.slug}`, "signin")}>
        Valorar
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Valorar</Button>
      {open && <RatingDialog game={game} onClose={() => setOpen(false)} />}
    </>
  );
}

function RatingDialog({ game, onClose }: { game: Game; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  const coverArt = game.coverUrl;
  const yearLabel = game.year > 0 ? game.year : "TBA";

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Valorar ${game.title}`}
      onClick={onClose}
    >
      <div
        className="relative my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/95 shadow-card backdrop-blur"
        style={{ maxHeight: "min(92vh, 760px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative h-36 shrink-0 overflow-hidden md:h-40">
          <div className="absolute inset-0 bg-gradient-to-br from-electric/25 via-violet/20 to-electric/10" />
          <div className="absolute -left-20 -top-14 h-52 w-52 rounded-full bg-electric/25 blur-3xl" />
          <div className="absolute -right-16 top-8 h-48 w-48 rounded-full bg-violet/25 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "32px 32px"
            }}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface/95 to-transparent" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/40 text-muted backdrop-blur transition hover:border-white/30 hover:bg-black/60 hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 px-6 pb-4 md:px-8">
            <div className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-card md:h-28 md:w-20">
              {coverArt ? (
                <Image src={coverArt} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] font-bold text-muted">
                  Sin cover
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-px w-5 rounded-full bg-electric" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-electric">
                  Tu valoración
                </p>
              </div>
              <h2 className="truncate text-xl font-black leading-tight md:text-2xl">{game.title}</h2>
              <p className="mt-0.5 truncate text-xs text-muted">
                {yearLabel}
                {game.developer ? ` · ${game.developer}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5 md:px-8">
          <CommunityRatingForm game={game} compact onSaved={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
}

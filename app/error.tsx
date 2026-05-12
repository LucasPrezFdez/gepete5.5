"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const recoveryTips = [
  "Reintenta la carga para recuperar la sección sin perder el contexto.",
  "Vuelve al inicio si el problema continúa y navega desde allí.",
  "Explora el catálogo mientras el servicio vuelve a responder."
];

export default function GlobalRouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[GameIndex] Route error:", error);
    }
  }, [error]);

  return (
    <section className="container-page relative isolate grid min-h-[calc(100vh-5rem)] place-items-center overflow-hidden py-10 sm:py-16">
      <div className="pointer-events-none absolute left-1/2 top-10 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-electric/20 blur-[110px]" />
      <div className="pointer-events-none absolute right-[8%] top-1/4 -z-10 h-56 w-56 rounded-full bg-violet/20 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-10 left-[12%] -z-10 h-44 w-44 rounded-full bg-danger/10 blur-[90px]" />

      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.13] via-white/[0.045] to-white/[0.02] p-px shadow-[0_30px_100px_rgba(0,0,0,0.48)]">
        <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-surface/90 px-5 py-6 backdrop-blur-xl sm:px-8 sm:py-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric/70 to-transparent" />
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-electric/10 blur-3xl" />

          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-electric/30 bg-electric/15 text-electric shadow-[0_0_34px_rgba(59,130,246,0.22)] md:mx-0">
              <svg
                aria-hidden="true"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.2 3.9 2.7 17.1A2 2 0 0 0 4.45 20h15.1a2 2 0 0 0 1.75-2.9L13.8 3.9a2.08 2.08 0 0 0-3.6 0Z"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <span className="rounded-full border border-danger/25 bg-danger/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-danger">
                  Carga interrumpida
                </span>
                {error.digest && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted">
                    Ref. {error.digest}
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
                No hemos podido cargar esta sección
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted md:mx-0">
                Puede ser un corte temporal, una respuesta lenta del servidor o un
                dato que no llegó a tiempo. Prueba de nuevo y, si sigue fallando,
                vuelve a un punto seguro.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
                <Button
                  className="h-12 gap-2 px-5"
                  disabled={isRetrying}
                  onClick={() => startRetry(() => reset())}
                >
                  {isRetrying ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Reintentando
                    </>
                  ) : (
                    <>
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v6h6M20 20v-6h-6M5.6 15.5A7.5 7.5 0 0 0 18.3 18M18.4 8.5A7.5 7.5 0 0 0 5.7 6"
                        />
                      </svg>
                      Reintentar
                    </>
                  )}
                </Button>
                <Button asChild href="/" variant="secondary" className="h-12 px-5">
                  Volver al inicio
                </Button>
                <Link
                  href="/games"
                  className="inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold text-muted transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  Explorar juegos
                  <span aria-hidden="true" className="ml-2">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            {recoveryTips.map((tip, index) => (
              <div
                key={tip}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-muted"
              >
                <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-xs font-black text-foreground">
                  {index + 1}
                </span>
                {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

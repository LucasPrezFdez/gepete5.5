"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function GlobalRouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[GameIndex] Route error:", error);
    }
  }, [error]);

  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="surface-card max-w-xl rounded-3xl p-8 text-center">
        <p className="text-sm uppercase tracking-widest text-muted">Algo ha fallado</p>
        <h1 className="mt-3 text-3xl font-black">No hemos podido cargar esta sección</h1>
        <p className="mt-3 text-muted">
          Es probable que sea temporal. Vuelve a intentarlo o regresa al inicio.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-muted/70">Referencia: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>Reintentar</Button>
          <Button asChild href="/" variant="secondary">
            Volver al inicio
          </Button>
          <Link href="/games" className="text-sm text-muted underline-offset-4 hover:underline">
            Explorar juegos
          </Link>
        </div>
      </div>
    </section>
  );
}

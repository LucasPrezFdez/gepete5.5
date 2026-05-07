import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="mb-3 rounded-full border border-white/10 px-3 py-1 text-sm text-muted">
        Error 404
      </p>
      <h1 className="text-4xl font-bold">No encontramos esta página</h1>
      <p className="mt-3 max-w-xl text-muted">
        Puede que el juego, lista o perfil haya cambiado de dirección.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </section>
  );
}

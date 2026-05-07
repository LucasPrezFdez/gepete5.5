"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createBrowserAuthClient } from "@/services/auth-browser";

const platforms = ["PC", "PlayStation 5", "Xbox Series", "Nintendo Switch", "Mobile"];
const genres = ["RPG", "Acción", "Aventura", "Terror", "Indie", "Estrategia", "Metroidvania"];

export default function OnboardingPage() {
  const router = useRouter();
  const [favoritePlatforms, setFavoritePlatforms] = useState<string[]>([]);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(list: string[], value: string, setter: (value: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const authClient = createBrowserAuthClient();
      const { data } = await authClient.auth.getSession();
      if (!data.session?.access_token) throw new Error("Inicia sesión para completar el onboarding.");
      const response = await fetch("/api/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ favoritePlatforms, favoriteGenres })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "No se pudieron guardar tus preferencias.");
      router.push("/games");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar tus preferencias.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="container-page grid min-h-[70vh] place-items-center py-10">
      <div className="surface-card w-full max-w-2xl rounded-3xl p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-electric">Primeros pasos</p>
        <h1 className="text-4xl font-black">Personaliza GameIndex</h1>
        <p className="mt-3 text-muted">Elige plataformas y géneros para mejorar rankings, recomendaciones y tu perfil público.</p>
        <div className="mt-8 space-y-6">
          <Picker title="Plataformas" values={platforms} selected={favoritePlatforms} onToggle={(value) => toggle(favoritePlatforms, value, setFavoritePlatforms)} />
          <Picker title="Géneros" values={genres} selected={favoriteGenres} onToggle={(value) => toggle(favoriteGenres, value, setFavoriteGenres)} />
        </div>
        {error && <p className="mt-5 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex gap-3">
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar preferencias"}</Button>
          <Button variant="ghost" asChild href="/games">Saltar por ahora</Button>
        </div>
      </div>
    </section>
  );
}

function Picker({ title, values, selected, onToggle }: { title: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <button key={value} type="button" onClick={() => onToggle(value)}>
            <Badge tone={selected.includes(value) ? "lime" : "muted"}>{value}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}



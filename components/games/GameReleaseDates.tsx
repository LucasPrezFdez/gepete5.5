import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type ReleaseDateEntry = {
  date: string | null;
  human: string | null;
  region: string | null;
  platform: string | null;
};

export function GameReleaseDates({ releaseDates }: { releaseDates: ReleaseDateEntry[] }) {
  if (!releaseDates.length) return null;

  const sorted = releaseDates
    .slice()
    .sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    })
    .slice(0, 24);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Fechas de lanzamiento</h2>
        <p className="text-sm text-muted">Lanzamientos por plataforma y región según IGDB.</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-white/[0.05] text-sm">
          {sorted.map((entry, index) => (
            <li key={index} className="grid gap-1 py-2 sm:grid-cols-[140px_1fr_auto] sm:items-center sm:gap-3">
              <span className="font-medium text-foreground">{formatDate(entry)}</span>
              <span className="text-muted">{entry.platform ?? "Plataforma sin especificar"}</span>
              {entry.region && <span className="text-xs text-muted">{entry.region}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function formatDate(entry: ReleaseDateEntry) {
  if (entry.date) {
    try {
      return new Date(entry.date).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      // ignore parse errors
    }
  }
  return entry.human ?? "Por confirmar";
}

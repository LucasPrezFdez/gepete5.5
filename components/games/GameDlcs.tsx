import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type DlcEntry = {
  name: string;
  slug: string | null;
  coverUrl: string | null;
  kind: "dlc" | "expansion";
};

export function GameDlcs({ dlcs }: { dlcs: DlcEntry[] }) {
  if (!dlcs.length) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Expansiones y DLC</h2>
        <p className="text-sm text-muted">{dlcs.length} contenidos adicionales encontrados.</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dlcs.map((dlc, index) => (
            <article
              key={`${dlc.slug ?? dlc.name}-${index}`}
              className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              {dlc.coverUrl ? (
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md">
                  <Image src={dlc.coverUrl} alt="" fill sizes="56px" className="object-cover" />
                </div>
              ) : (
                <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-[10px] text-muted">
                  Sin portada
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{dlc.name}</p>
                <Badge tone={dlc.kind === "expansion" ? "violet" : "blue"}>
                  {dlc.kind === "expansion" ? "Expansión" : "DLC"}
                </Badge>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

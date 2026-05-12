import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type WebsiteEntry = { category: string; url: string };

const LABELS: Record<string, string> = {
  official: "Web oficial",
  steam: "Steam",
  epic: "Epic Games",
  gog: "GOG",
  wikipedia: "Wikipedia",
  youtube: "YouTube",
  twitch: "Twitch",
  twitter: "Twitter / X",
  instagram: "Instagram",
  reddit: "Reddit",
  discord: "Discord",
  other: "Enlace externo"
};

const ORDER = ["official", "steam", "epic", "gog", "wikipedia", "youtube", "twitch", "twitter", "instagram", "reddit", "discord", "other"];

export function GameLinks({ websites }: { websites: WebsiteEntry[] }) {
  if (!websites.length) return null;

  const sorted = websites
    .slice()
    .sort((a, b) => {
      const aIndex = ORDER.indexOf(a.category);
      const bIndex = ORDER.indexOf(b.category);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Enlaces oficiales</h2>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-wrap gap-2">
          {sorted.map((entry, index) => (
            <li key={`${entry.url}-${index}`}>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground motion-safe:transition-colors motion-safe:duration-150 hover:border-electric/40 hover:bg-electric/10 hover:text-blue-200"
              >
                {LABELS[entry.category] ?? entry.category}
                <ExternalIcon />
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 opacity-70">
      <path d="M15 3h6v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 14v7H3V3h7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

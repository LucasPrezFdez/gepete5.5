import { Badge } from "@/components/ui/Badge";

export function GenreBadge({ children }: { children: React.ReactNode }) {
  return <Badge tone="violet">{children}</Badge>;
}

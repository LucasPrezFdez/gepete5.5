import { Badge } from "@/components/ui/Badge";

export function PlatformBadge({ children }: { children: React.ReactNode }) {
  return <Badge tone="blue">{children}</Badge>;
}

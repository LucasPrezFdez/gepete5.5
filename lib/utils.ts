export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("es", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function scoreTone(score?: number | null) {
  if (!score) return "border-white/10 bg-white/5 text-muted";
  if (score >= 9) return "border-lime/40 bg-lime/10 text-lime";
  if (score >= 8) return "border-electric/40 bg-electric/10 text-electric";
  if (score >= 7) return "border-violet/40 bg-violet/10 text-violet";
  return "border-danger/40 bg-danger/10 text-danger";
}

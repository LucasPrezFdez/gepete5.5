import type { CategoryDatum, TimeSeriesPoint } from "@/services/admin-stats";

type ChartCardProps = {
  title: string;
  hint?: string;
  total?: string | number;
  children: React.ReactNode;
};

export function ChartCard({ title, hint, total, children }: ChartCardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
        </div>
        {total !== undefined ? (
          <span className="font-mono text-xl font-bold tabular-nums text-foreground">{total}</span>
        ) : null}
      </header>
      {children}
    </div>
  );
}

export function SparkLine({
  data,
  accent = "#A3E635",
  height = 80
}: {
  data: TimeSeriesPoint[];
  accent?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <EmptyHint height={height} />;
  }

  const width = 600;
  const padding = 8;
  const max = Math.max(1, ...data.map((point) => point.value));
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1);
  const points = data.map((point, index) => {
    const x = padding + index * stepX;
    const y = padding + (height - padding * 2) * (1 - point.value / max);
    return { x, y, point };
  });

  const pathLine = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const pathArea = `${pathLine} L ${points[points.length - 1].x.toFixed(2)} ${height - padding} L ${points[0].x.toFixed(
    2
  )} ${height - padding} Z`;

  const lastValue = data[data.length - 1].value;
  const firstNonZero = data.find((p) => p.value > 0)?.value ?? 0;
  const trend = firstNonZero === 0 ? 0 : ((lastValue - firstNonZero) / firstNonZero) * 100;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-${accent.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={pathArea} fill={`url(#spark-${accent.replace("#", "")})`} />
        <path d={pathLine} fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={accent} />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted">
        <span>{data[0].date}</span>
        <span className={trend >= 0 ? "text-[#A3E635]" : "text-danger"}>
          {trend >= 0 ? "+" : ""}
          {trend.toFixed(0)}%
        </span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}

export function HorizontalBarChart({
  data,
  accent = "#60A5FA",
  labelMap
}: {
  data: CategoryDatum[];
  accent?: string;
  labelMap?: Record<string, string>;
}) {
  if (data.length === 0) {
    return <EmptyHint height={80} />;
  }
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const total = data.reduce((sum, datum) => sum + datum.value, 0);

  return (
    <ul className="space-y-2">
      {data.map((datum) => {
        const widthPercent = (datum.value / max) * 100;
        const sharePercent = total > 0 ? (datum.value / total) * 100 : 0;
        return (
          <li key={datum.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="truncate font-medium">{labelMap?.[datum.label] ?? datum.label}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                {datum.value.toLocaleString("es-ES")}{" "}
                <span className="text-muted/60">({sharePercent.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${widthPercent}%`, backgroundColor: accent }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyHint({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] text-[11px] text-muted"
      style={{ height }}
    >
      Sin datos en el rango seleccionado.
    </div>
  );
}

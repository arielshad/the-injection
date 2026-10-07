import type { Severity } from "@/data/schema";

const LEVEL: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SHORT: Record<Severity, string> = { critical: "CRIT", high: "HIGH", medium: "MED", low: "LOW", info: "INFO" };
const COLOR: Record<Severity, string> = {
  critical: "var(--sev-critical)",
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
  info: "var(--sev-info)",
};

/**
 * Severity as a signal meter: four rising bars, as many lit as the level
 * (Sentry and incident.io read priority the same way), plus a short label.
 * Static SVG, so it renders on the server and needs no JavaScript.
 */
export function SeverityMeter({ severity, label = true, size = "sm", className = "" }: { severity: Severity; label?: boolean; size?: "sm" | "md"; className?: string }) {
  const n = LEVEL[severity];
  const color = COLOR[severity];
  const w = size === "md" ? 26 : 20;
  const h = size === "md" ? 14 : 11;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-medium uppercase tracking-[0.06em] ${size === "md" ? "text-[12px]" : "text-[10.5px]"} ${className}`} style={{ color }}>
      <svg width={w} height={h} viewBox="0 0 22 12" aria-hidden="true" className="shrink-0">
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x={k * 6} y={12 - (k + 1) * 3} width={4} height={(k + 1) * 3} rx={0.6} fill={k < n ? color : "var(--line)"} />
        ))}
      </svg>
      {label ? <span>{SHORT[severity]}</span> : <span className="sr-only">{severity}</span>}
    </span>
  );
}

export default SeverityMeter;

import { StatusBar } from "@/components/ui/status-bar";
import type { StatusBarData } from "@/components/ui/status-bar-utils/status.types";
import { u } from "@/site";

export interface StripDay {
  day: string; // YYYY-MM-DD
  worst: "error" | "degraded" | "info" | "success";
  stories: { id: string; title: string; severity: string }[];
}

export interface Strip {
  name: string;
  days: StripDay[];
}

/** The serialised form: one letter per day (s/i/d/e) plus the stories on days that have any. */
export interface CompactStrip {
  name: string;
  worst: string;
  stories: Record<number, [string, string][]>;
}

const LETTER: Record<string, StripDay["worst"]> = { s: "success", i: "info", d: "degraded", e: "error" };

function expand(end: string, c: CompactStrip): Strip {
  const endMs = Date.parse(`${end}T12:00:00Z`);
  const n = c.worst.length;
  return {
    name: c.name,
    days: [...c.worst].map((ch, k) => ({
      day: new Date(endMs - (n - 1 - k) * 86_400_000).toISOString().slice(0, 10),
      worst: LETTER[ch],
      stories: (c.stories[k] ?? []).map(([id, title]) => ({ id, title, severity: "" })),
    })),
  };
}

const LABEL: Record<StripDay["worst"], string> = {
  error: "High or critical",
  degraded: "Medium",
  info: "Low or info",
  success: "Quiet",
};

/**
 * 30 days of exposure per ecosystem, drawn with openstatus's status bar
 * (21st.dev @openstatusHQ/status-bar): one cell per day, coloured by the worst
 * story that day, with the stories in the hover card.
 */
export default function ExposureStrips({ end, strips: compact }: { end: string; strips: CompactStrip[] }) {
  const strips = compact.map((c) => expand(end, c));
  return (
    <div className="divide-y divide-line">
      {strips.map((s) => {
        const data: StatusBarData[] = s.days.map((d) => ({
          day: `${d.day}T12:00:00Z`,
          bar: [{ status: d.worst, height: 100 }],
          card: [{ status: d.worst, value: d.stories.length ? `${d.stories.length} ${d.stories.length === 1 ? "story" : "stories"} · ${LABEL[d.worst]}` : "No stories" }],
          events: d.stories.map((st) => ({ id: st.id, name: st.title, type: "report" as const, from: null, to: null, status: d.worst === "success" ? undefined : d.worst, shortlink: u(`/items/${st.id}/`) })),
        }));
        const count = s.days.reduce((n, d) => n + d.stories.length, 0);
        return (
          <div key={s.name} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[11rem_1fr_5.5rem] sm:py-2.5">
            <span className="font-mono text-[11px] text-ink">{s.name}</span>
            <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1 [&_[data-slot=status-bar]]:h-[26px]">
              <StatusBar data={data} />
            </div>
            <span className="text-right font-mono text-[11px] text-muted-foreground">{count} {count === 1 ? "event" : "events"}</span>
          </div>
        );
      })}
    </div>
  );
}

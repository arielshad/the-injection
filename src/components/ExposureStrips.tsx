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
export default function ExposureStrips({ strips }: { strips: Strip[] }) {
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
          <div key={s.name} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-4 py-2.5 sm:grid-cols-[11rem_1fr_5.5rem]">
            <span className="font-mono text-[11px] text-ink">{s.name}</span>
            <div className="[&_[data-slot=status-bar]]:h-[26px]">
              <StatusBar data={data} />
            </div>
            <span className="text-right font-mono text-[11px] text-muted-foreground">{count} {count === 1 ? "event" : "events"}</span>
          </div>
        );
      })}
    </div>
  );
}

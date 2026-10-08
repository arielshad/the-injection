import { useEffect, useState, type CSSProperties } from "react";
import { NumberFlow } from "@/components/ui/number-flow";
import StatusDot from "@/components/ui/status-dot";

/** The sweep cron in update-feed.yml: minute 17 of every hour, UTC. */
const SLOT_MINUTE = 17;

function nextSweep(now: Date) {
  const t = new Date(now);
  t.setUTCMinutes(SLOT_MINUTE, 0, 0);
  if (t.getTime() <= now.getTime()) t.setUTCHours(t.getUTCHours() + 1);
  return t.getTime();
}

/**
 * A sweep older than this is overdue: one missed slot plus the longest run
 * (two 35m attempts, build and push) and GitHub's usual cron delay.
 */
const STALE_MS = 3 * 60 * 60 * 1000;

/** "19:47" when the sweep was today (UTC), "Oct 7 19:47" otherwise. */
function sweepLabel(iso: string, now: number) {
  const hhmm = iso.slice(11, 16);
  if (iso.slice(0, 10) === new Date(now).toISOString().slice(0, 10)) return hhmm;
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} ${hhmm}`;
}

/**
 * "● LIVE  last sweep 07:05 UTC · next in 00:42:12". The dot ripples
 * (21st.dev @edwinvakayil/status-dot) and the countdown digits roll
 * (21st.dev @soralabs/number-flow). Server-rendered with the last sweep time;
 * the countdown starts once the island hydrates. When the last sweep is
 * overdue the marker reads DELAYED and the time carries its date, so a
 * stalled schedule never passes for a live one.
 */
export default function SweepClock({ lastSweep, stacked = false }: { lastSweep: string; stacked?: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? null : Math.max(0, Math.floor((nextSweep(new Date(now)) - now) / 1000));
  const stale = now !== null && now - Date.parse(lastSweep) > STALE_MS;
  const h = left === null ? 0 : Math.floor(left / 3600);
  const m = left === null ? 0 : Math.floor((left % 3600) / 60);
  const s = left === null ? 0 : left % 60;
  const two = { minimumIntegerDigits: 2, useGrouping: false } as const;

  return (
    <span className={`font-mono text-[11px] tracking-[0.02em] text-muted-foreground ${stacked ? "flex flex-col items-start gap-2" : "inline-flex items-center gap-3"}`}>
      {stale ? (
        <span className="inline-flex items-center gap-2 text-warning">
          <StatusDot tone="warning" animate={false} size="sm" label="Delayed" style={{ "--status-dot-warning": "var(--warning)" } as CSSProperties} />
          DELAYED
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-acid">
          <StatusDot tone="success" animate size="sm" label="Live" style={{ "--status-dot-success": "var(--acid)" } as CSSProperties} />
          LIVE
        </span>
      )}
      <span>
        last sweep <time dateTime={lastSweep}>{sweepLabel(lastSweep, now ?? Date.parse(lastSweep))}</time> UTC
      </span>
      {!stacked && <span aria-hidden="true">·</span>}
      <span className="inline-flex items-center gap-1.5" aria-live="off">
        next in
        {left === null ? (
          <span className="tabular-nums text-ink">--:--:--</span>
        ) : (
          <span className="inline-flex tabular-nums text-ink" role="timer" aria-label={`${h} hours ${m} minutes until the next sweep`}>
            <NumberFlow value={h} format={two} />:<NumberFlow value={m} format={two} />:<NumberFlow value={s} format={two} />
          </span>
        )}
      </span>
    </span>
  );
}

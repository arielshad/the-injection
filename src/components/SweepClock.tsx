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

const hhmm = (iso: string) => iso.slice(11, 16);

/**
 * "● LIVE  last sweep 07:05 UTC · next in 00:42:12". The dot ripples
 * (21st.dev @edwinvakayil/status-dot) and the countdown digits roll
 * (21st.dev @soralabs/number-flow). Server-rendered with the last sweep time;
 * the countdown starts once the island hydrates.
 */
export default function SweepClock({ lastSweep, stacked = false }: { lastSweep: string; stacked?: boolean }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((nextSweep(new Date()) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const h = left === null ? 0 : Math.floor(left / 3600);
  const m = left === null ? 0 : Math.floor((left % 3600) / 60);
  const s = left === null ? 0 : left % 60;
  const two = { minimumIntegerDigits: 2, useGrouping: false } as const;

  return (
    <span className={`font-mono text-[11px] tracking-[0.02em] text-muted-foreground ${stacked ? "flex flex-col items-start gap-2" : "inline-flex items-center gap-3"}`}>
      <span className="inline-flex items-center gap-2 text-acid">
        <StatusDot tone="success" animate size="sm" label="Live" style={{ "--status-dot-success": "var(--acid)" } as CSSProperties} />
        LIVE
      </span>
      <span>
        last sweep <time dateTime={lastSweep}>{hhmm(lastSweep)}</time> UTC
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

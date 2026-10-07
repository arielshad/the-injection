import { useMemo, useState } from "react";
import type { Category, Severity } from "@/data/schema";

export interface SlimItem {
  id: string;
  title: string;
  summary: string;
  org: string;
  date: string;
  severity: Severity;
  categories: Category[];
  credits: string[];
  tags: string[];
  cve?: string;
}

interface Props {
  items: SlimItem[];
  categories: { id: Category; label: string; count: number }[];
  severities: Severity[];
}

const SEV_DOT: Record<Severity, string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  info: "bg-sev-info",
};

const SEV_TEXT: Record<Severity, string> = {
  critical: "text-sev-critical",
  high: "text-sev-high",
  medium: "text-[oklch(0.58_0.13_75)]",
  low: "text-sev-low",
  info: "text-sev-info",
};

function formatDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The feed. Rendered to HTML at build time with every item in it, so crawlers
 * and readers without JS get the full list; the filters only hide rows.
 */
export default function FeedExplorer({ items, categories, severities }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [sev, setSev] = useState<Severity | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (cat && !it.categories.includes(cat)) return false;
      if (sev && it.severity !== sev) return false;
      if (!q) return true;
      return [it.title, it.summary, it.org, it.cve ?? "", ...it.tags, ...it.credits]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, query, cat, sev]);

  const byDay = useMemo(() => {
    const groups = new Map<string, SlimItem[]>();
    for (const it of visible) {
      const list = groups.get(it.date) ?? [];
      list.push(it);
      groups.set(it.date, list);
    }
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  const label = (c: Category) => categories.find((x) => x.id === c)?.label ?? c;

  return (
    <section aria-labelledby="feed-heading" className="grid gap-10 lg:grid-cols-[1fr_15rem]">
      <div>
        <div className="flex items-baseline justify-between border-b border-ink pb-2">
          <h2 id="feed-heading" className="font-heading text-3xl">The feed</h2>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {visible.length} of {items.length} items
          </p>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 focus-within:border-ink">
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr-only">Search the feed</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: CVE, product, researcher, technique"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        {byDay.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">Nothing matches. Clear a filter or try another word.</p>
        )}

        {byDay.map(([day, list]) => (
          <div key={day} className="mt-8">
            <h3 className="sticky top-0 z-10 -mx-1 bg-paper/95 px-1 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground backdrop-blur">
              <time dateTime={day}>{formatDay(day)}</time>
            </h3>
            <ol className="divide-y divide-border border-y border-border">
              {list.map((it) => (
                <li key={it.id}>
                  <a href={`/items/${it.id}/`} className="group grid grid-cols-[auto_1fr] gap-x-4 py-4 sm:grid-cols-[6.5rem_1fr]">
                    <div className="flex flex-col gap-1 pt-1">
                      <span className={`flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${SEV_TEXT[it.severity]}`}>
                        <span className={`size-2 rounded-full ${SEV_DOT[it.severity]}`} />
                        <span className="hidden sm:inline">{it.severity}</span>
                      </span>
                      <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:block">{label(it.categories[0])}</span>
                    </div>
                    <div>
                      <p className="font-heading text-[1.45rem] leading-tight decoration-sev-critical decoration-1 underline-offset-4 group-hover:underline">
                        {it.title}
                      </p>
                      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted-foreground">{it.summary}</p>
                      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                        <span className="text-ink">{it.org}</span>
                        {it.credits.length > 0 && <> · by {it.credits.slice(0, 2).join(", ")}{it.credits.length > 2 ? " +" + (it.credits.length - 2) : ""}</>}
                        {it.cve && <> · {it.cve}</>}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start" aria-label="Filters">
        <div>
          <p className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-wider">Severity</p>
          <ul className="mt-2 space-y-1">
            {severities.filter((s) => items.some((i) => i.severity === s)).map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => setSev(sev === s ? null : s)}
                  aria-pressed={sev === s}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm capitalize hover:bg-muted ${sev === s ? "bg-ink text-paper hover:bg-ink" : ""}`}
                >
                  <span className="flex items-center gap-2"><span className={`size-2 rounded-full ${SEV_DOT[s]}`} />{s}</span>
                  <span className="font-mono text-[11px] opacity-70">{items.filter((i) => i.severity === s).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-wider">Category</p>
          <ul className="mt-2 space-y-1">
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCat(cat === c.id ? null : c.id)}
                  aria-pressed={cat === c.id}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${cat === c.id ? "bg-ink text-paper hover:bg-ink" : ""}`}
                >
                  <span>{c.label}</span>
                  <span className="font-mono text-[11px] opacity-70">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {(cat || sev || query) && (
          <button
            type="button"
            onClick={() => { setCat(null); setSev(null); setQuery(""); }}
            className="font-mono text-[11px] uppercase tracking-wider text-sev-critical hover:underline"
          >
            Clear filters
          </button>
        )}
      </aside>
    </section>
  );
}

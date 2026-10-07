import { useEffect, useMemo, useState } from "react";
import type { Category, Severity } from "@/data/schema";
import { u } from "@/site";
import { SEV_BORDER, SEV_GLYPH, SEV_TEXT } from "@/lib/severity";


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

/** "Yesterday, Mon 6 Oct" style labels, relative to the build's newest day. */
function dayLabel(iso: string, newest: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const base = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const diff = Math.round((Date.parse(`${newest}T12:00:00Z`) - d.getTime()) / 86_400_000);
  if (diff === 0) return `Latest, ${base}`;
  if (diff === 1) return `Day before, ${base}`;
  return base;
}

/**
 * The feed. Rendered to HTML at build time with every item in it, so crawlers
 * and readers without JS get the full list; the filters only hide rows. The
 * active filters live in the URL query, so a filtered view can be shared.
 */
export default function FeedExplorer({ items, categories, severities }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [sev, setSev] = useState<Severity | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("cat");
    const s = p.get("sev");
    if (c && categories.some((x) => x.id === c)) setCat(c as Category);
    if (s && severities.includes(s as Severity)) setSev(s as Severity);
    setQuery(p.get("q") ?? "");
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (cat) p.set("cat", cat);
    if (sev) p.set("sev", sev);
    if (query.trim()) p.set("q", query.trim());
    const qs = p.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [cat, sev, query]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (cat && !it.categories.includes(cat)) return false;
      if (sev && it.severity !== sev) return false;
      if (!q) return true;
      return [it.title, it.summary, it.org, it.cve ?? "", ...it.tags, ...it.credits].join(" ").toLowerCase().includes(q);
    });
  }, [items, query, cat, sev]);

  const byDay = useMemo(() => {
    const groups = new Map<string, SlimItem[]>();
    for (const it of visible) groups.set(it.date, [...(groups.get(it.date) ?? []), it]);
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  const newest = items.reduce((m, i) => (i.date > m ? i.date : m), "0000-00-00");
  const label = (c: Category) => categories.find((x) => x.id === c)?.label ?? c;
  const presentSev = severities.filter((s) => items.some((i) => i.severity === s));
  const pill = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1 text-[13px] transition-colors ${active ? "border-ink bg-ink text-paper" : "border-border hover:border-ink"}`;

  return (
    <section aria-labelledby="feed-heading" className="grid gap-10 lg:grid-cols-[1fr_15rem]">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between border-b-[3px] border-ink pb-2">
          <h2 id="feed-heading" className="font-heading text-3xl">The feed</h2>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {visible.length} of {items.length} stories
          </p>
        </div>

        <label className="mt-4 flex items-center gap-2 border-b border-border px-1 py-2 focus-within:border-ink">
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr-only">Search the feed</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a CVE, product, researcher or technique"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        {/* Below lg the sidebar collapses into pill rows. */}
        <div className="mt-3 space-y-2 lg:hidden">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {presentSev.map((s) => (
              <button key={s} type="button" aria-pressed={sev === s} onClick={() => setSev(sev === s ? null : s)} className={pill(sev === s)}>
                <span className={sev === s ? "" : SEV_TEXT[s]}>{SEV_GLYPH[s]}</span> <span className="capitalize">{s}</span>
              </button>
            ))}
          </div>
          {categories.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {categories.map((c) => (
                <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} className={pill(cat === c.id)}>
                  {c.label} <span className="font-mono text-[11px] opacity-60">{c.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {byDay.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">Nothing matches. Clear a filter or try another word.</p>
        )}

        {byDay.map(([day, list]) => {
          const worst = severities.find((s) => list.some((i) => i.severity === s));
          return (
            <div key={day} className="mt-8">
              <h3 className="sticky top-0 z-10 flex items-center justify-between border-y border-ink bg-paper px-0 py-1.5 font-mono text-[11px] uppercase tracking-wider">
                <time dateTime={day} className="font-semibold">{dayLabel(day, newest)}</time>
                <span className="text-muted-foreground">
                  {list.length} {list.length === 1 ? "story" : "stories"}
                  {worst && worst !== "info" && <> · <span className={SEV_TEXT[worst]}>{SEV_GLYPH[worst]} {list.filter((i) => i.severity === worst).length} {worst}</span></>}
                </span>
              </h3>
              <ol className="divide-y divide-border">
                {list.map((it) => (
                  <li key={it.id} className={`border-l-[3px] ${SEV_BORDER[it.severity]}`}>
                    <a href={u(`/items/${it.id}/`)} className="group grid grid-cols-1 gap-x-5 py-4 pl-4 sm:grid-cols-[5.5rem_1fr] sm:pl-5">
                      <span className={`hidden pt-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider sm:block ${SEV_TEXT[it.severity]}`}>
                        {SEV_GLYPH[it.severity]} {it.severity}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                          <span className={`sm:hidden ${SEV_TEXT[it.severity]}`}>{SEV_GLYPH[it.severity]} {it.severity} · </span>
                          {label(it.categories[0])} · <span className="text-ink">{it.org}</span>
                          {it.cve && <> · {it.cve}</>}
                        </p>
                        <p className="mt-1 font-heading text-[1.4rem] leading-[1.15] decoration-sev-critical decoration-1 underline-offset-4 group-hover:underline">
                          {it.title}
                        </p>
                        <p className="mt-1.5 text-[0.94rem] leading-relaxed text-muted-foreground">{it.summary}</p>
                        {it.credits.length > 0 && (
                          <p className="mt-2 text-[12.5px] text-muted-foreground">
                            Research by <span className="text-ink">{it.credits.slice(0, 3).join(", ")}</span>
                            {it.credits.length > 3 && ` and ${it.credits.length - 3} more`}
                          </p>
                        )}
                      </div>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <aside className="hidden space-y-8 lg:sticky lg:top-6 lg:block lg:self-start" aria-label="Filters">
        <div>
          <p className="border-b-[3px] border-ink pb-2 font-mono text-[11px] uppercase tracking-wider">Severity</p>
          <ul className="mt-2 space-y-0.5">
            {presentSev.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => setSev(sev === s ? null : s)}
                  aria-pressed={sev === s}
                  className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm capitalize hover:bg-muted ${sev === s ? "bg-ink text-paper hover:bg-ink" : ""}`}
                >
                  <span className="flex items-center gap-2"><span className={sev === s ? "" : SEV_TEXT[s]} aria-hidden>{SEV_GLYPH[s]}</span>{s}</span>
                  <span className="font-mono text-[11px] opacity-70">{items.filter((i) => i.severity === s).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {categories.length > 1 && (
          <div>
            <p className="border-b-[3px] border-ink pb-2 font-mono text-[11px] uppercase tracking-wider">Category</p>
            <ul className="mt-2 space-y-0.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setCat(cat === c.id ? null : c.id)}
                    aria-pressed={cat === c.id}
                    className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted ${cat === c.id ? "bg-ink text-paper hover:bg-ink" : ""}`}
                  >
                    <span>{c.label}</span>
                    <span className="font-mono text-[11px] opacity-70">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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

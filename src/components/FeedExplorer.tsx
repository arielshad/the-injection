import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Severity } from "@/data/schema";
import { u } from "@/site";
import { SeverityMeter } from "@/components/SeverityMeter";
import { coverArt } from "@/lib/cover";

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
  image?: string;
  affected?: string[];
}

interface Props {
  items: SlimItem[];
  categories: { id: Category; label: string; count: number }[];
  severities: Severity[];
}

const EDGE: Record<Severity, string> = {
  critical: "var(--sev-critical)",
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
  info: "var(--sev-info)",
};

/** The source's image over the generated cover. Hides itself if it failed, including failures before hydration. */
function SourceImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return null;
  return <img ref={ref} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" onError={() => setFailed(true)} />;
}

/** A generated cover in miniature: same art as the big covers, seeded by the id. */
function Thumb({ it }: { it: SlimItem }) {
  const art = coverArt(it);
  return (
    <span className="absolute inset-0" style={{ background: art.bg }}>
      <span dangerouslySetInnerHTML={{ __html: art.svg }} />
      <span className="absolute inset-0 flex items-end p-2 font-heading text-[11px] font-semibold leading-[1.05] sm:text-[13px]" style={{ color: art.ink }}>
        {art.text}
      </span>
    </span>
  );
}

/**
 * The incident feed. Rendered to HTML at build time with every item in it, so
 * crawlers and readers without JS get the full list; the filters only hide
 * rows. The active filters live in the URL query, so a filtered view can be
 * shared.
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

  const label = (c: Category) => categories.find((x) => x.id === c)?.label ?? c;
  const presentSev = severities.filter((s) => items.some((i) => i.severity === s));
  const chip = (active: boolean) =>
    `flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-left font-mono text-[11px] uppercase tracking-[0.04em] transition-colors ${active ? "bg-acid text-black" : "text-muted-foreground hover:bg-panel-2 hover:text-ink"}`;

  return (
    <section aria-labelledby="feed-heading" className="grid gap-8 lg:grid-cols-[1fr_14rem]">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          <h2 id="feed-heading">Incident feed</h2>
          <span>{visible.length} of {items.length} · newest first</span>
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-sm border border-line bg-panel px-3 py-2.5 focus-within:border-acid">
          <span aria-hidden className="font-mono text-[12px] text-acid">&gt;</span>
          <span className="sr-only">Search the feed</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="grep: CVE, product, researcher, technique"
            className="w-full bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-muted-foreground"
          />
        </label>

        {/* Below lg the sidebar becomes two scrollable chip rows. */}
        <div className="mt-3 space-y-2 lg:hidden">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {presentSev.map((s) => (
              <button key={s} type="button" aria-pressed={sev === s} onClick={() => setSev(sev === s ? null : s)} className={`shrink-0 rounded-sm border px-2.5 py-1.5 ${sev === s ? "border-acid" : "border-line"}`}>
                <SeverityMeter severity={s} />
              </button>
            ))}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {categories.length > 1 && categories.map((c) => (
              <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} className={`shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1.5 font-mono text-[10.5px] uppercase ${cat === c.id ? "border-acid text-acid" : "border-line text-muted-foreground"}`}>
                {c.label} {c.count}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 && (
          <p className="py-16 text-center font-mono text-[12px] text-muted-foreground">0 matches. Clear a filter or try another term.</p>
        )}

        <ol className="mt-3 space-y-[2px]">
          {visible.map((it) => (
            <li key={it.id}>
              <a
                href={u(`/items/${it.id}/`)}
                className="group grid grid-cols-[88px_1fr] items-center gap-4 border-l-2 bg-panel py-3 pl-3 pr-4 transition-colors hover:bg-panel-2 sm:grid-cols-[132px_1fr_auto] sm:gap-5"
                style={{ borderLeftColor: EDGE[it.severity] }}
              >
                <span className="relative block aspect-video overflow-hidden rounded-[2px] bg-panel-2">
                  {/* The generated cover always sits underneath, so a hotlink-blocked image falls back to it. */}
                  <Thumb it={it} />
                  {it.image && (
                    <SourceImage src={it.image} alt={it.title} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground">
                    <SeverityMeter severity={it.severity} />
                    <span>{label(it.categories[0])}</span>
                    <span className="text-ink/70">{it.org}</span>
                    {it.cve && <span className="hidden sm:inline">{it.cve}</span>}
                  </span>
                  <span className="mt-1.5 block font-heading text-[17px] font-semibold leading-snug text-white group-hover:underline group-hover:decoration-acid sm:text-[19px]">{it.title}</span>
                  <span className="mt-1 hidden text-[13.5px] leading-relaxed text-muted-foreground sm:line-clamp-1">{it.summary}</span>
                </span>
                <time dateTime={it.date} className="hidden self-start pt-0.5 font-mono text-[10.5px] text-muted-foreground sm:block">{it.date}</time>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <aside className="hidden space-y-6 lg:sticky lg:top-6 lg:block lg:self-start" aria-label="Filters">
        <div>
          <p className="border-b border-line pb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Severity</p>
          <ul className="mt-2 space-y-0.5">
            {presentSev.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => setSev(sev === s ? null : s)} aria-pressed={sev === s} className={chip(sev === s)}>
                  <SeverityMeter severity={s} className={sev === s ? "!text-black" : ""} />
                  <span>{items.filter((i) => i.severity === s).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {categories.length > 1 && (
          <div>
            <p className="border-b border-line pb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Category</p>
            <ul className="mt-2 space-y-0.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setCat(cat === c.id ? null : c.id)} aria-pressed={cat === c.id} className={chip(cat === c.id)}>
                    <span>{c.label}</span>
                    <span>{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(cat || sev || query) && (
          <button type="button" onClick={() => { setCat(null); setSev(null); setQuery(""); }} className="font-mono text-[11px] uppercase text-acid hover:underline">
            [ clear filters ]
          </button>
        )}
      </aside>
    </section>
  );
}

import { useEffect, useState } from "react";
import type { Category, Severity } from "@/data/schema";
import { SeverityMeter } from "@/components/SeverityMeter";

interface State { q: string; cat: Category | null; sev: Severity | null }

interface Props {
  layout: "top" | "side";
  categories: { id: Category; label: string; count: number }[];
  severities: { id: Severity; count: number }[];
}

const EVENT = "feed:filter";

/** Hide the rows that do not match. The rows are server-rendered; this only toggles them. */
function apply({ q, cat, sev }: State) {
  const term = q.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll<HTMLLIElement>("[data-feed-list] > li").forEach((li) => {
    const ok =
      (!cat || (li.dataset.cats ?? "").split(" ").includes(cat)) &&
      (!sev || li.dataset.sev === sev) &&
      (!term || (li.textContent ?? "").toLowerCase().includes(term));
    li.hidden = !ok;
    if (ok) shown++;
  });
  document.querySelectorAll("[data-feed-count]").forEach((el) => (el.textContent = String(shown)));
  document.querySelector("[data-feed-empty]")?.classList.toggle("hidden", shown > 0);

  const p = new URLSearchParams();
  if (cat) p.set("cat", cat);
  if (sev) p.set("sev", sev);
  if (term) p.set("q", q.trim());
  const next = `${location.pathname}${p.toString() ? `?${p}` : ""}`;
  if (next !== `${location.pathname}${location.search}`) history.replaceState(null, "", next);
}

/**
 * Feed filters: search, severity and category. Two instances can be on the
 * page (above the list on mobile, in the sidebar on desktop); they stay in
 * sync through a window event. Filters live in the URL so a view can be shared.
 */
export default function FeedFilters({ layout, categories, severities }: Props) {
  const [state, setState] = useState<State>({ q: "", cat: null, sev: null });

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const c = p.get("cat");
    const s = p.get("sev");
    const init: State = {
      q: p.get("q") ?? "",
      cat: categories.some((x) => x.id === c) ? (c as Category) : null,
      sev: severities.some((x) => x.id === s) ? (s as Severity) : null,
    };
    setState(init);
    apply(init);
    const onSync = (e: Event) => setState((e as CustomEvent<State>).detail);
    window.addEventListener(EVENT, onSync);
    // "/" jumps to search, as on GitHub and most feeds. Only the visible box takes focus.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const box = [...document.querySelectorAll<HTMLInputElement>("input[data-feed-search]")].find((i) => i.offsetParent !== null);
      if (!box) return;
      e.preventDefault();
      box.focus();
      box.select();
    };
    // Both instances hydrate on every screen size; one listener is enough.
    if (layout === "side") window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(EVENT, onSync);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const update = (patch: Partial<State>) => {
    const next = { ...state, ...patch };
    setState(next);
    apply(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };

  const search = (
    <label className="flex items-center gap-2 rounded-sm border border-line bg-panel px-3 py-2.5 focus-within:border-acid">
      <span aria-hidden className="font-mono text-[12px] text-acid">&gt;</span>
      <span className="sr-only">Search the feed</span>
      <input
        type="search"
        data-feed-search
        aria-keyshortcuts="/"
        value={state.q}
        onChange={(e) => update({ q: e.target.value })}
        placeholder="grep: CVE, product, researcher"
        className="w-full bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-muted-foreground"
      />
      <kbd aria-hidden className="hidden rounded-[3px] border border-line px-1.5 font-mono text-[10px] text-muted-foreground lg:inline">/</kbd>
    </label>
  );
  const active = state.q || state.cat || state.sev;
  const clear = active && (
    <button type="button" onClick={() => update({ q: "", cat: null, sev: null })} className="font-mono text-[11px] uppercase text-acid hover:underline">
      [ clear filters ]
    </button>
  );

  if (layout === "top") {
    return (
      <div className="space-y-2">
        {search}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {severities.map((s) => (
            <button key={s.id} type="button" aria-pressed={state.sev === s.id} onClick={() => update({ sev: state.sev === s.id ? null : s.id })} className={`shrink-0 rounded-sm border px-2.5 py-1.5 ${state.sev === s.id ? "border-acid" : "border-line"}`}>
              <SeverityMeter severity={s.id} />
            </button>
          ))}
        </div>
        {categories.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {categories.map((c) => (
              <button key={c.id} type="button" aria-pressed={state.cat === c.id} onClick={() => update({ cat: state.cat === c.id ? null : c.id })} className={`shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1.5 font-mono text-[10.5px] uppercase ${state.cat === c.id ? "border-acid text-acid" : "border-line text-muted-foreground"}`}>
                {c.label} {c.count}
              </button>
            ))}
          </div>
        )}
        {clear}
      </div>
    );
  }

  const row = (on: boolean) =>
    `flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-left font-mono text-[11px] uppercase tracking-[0.04em] transition-colors ${on ? "bg-acid text-black" : "text-muted-foreground hover:bg-panel-2 hover:text-ink"}`;
  return (
    <div className="space-y-6">
      {search}
      <div>
        <p className="border-b border-line pb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Severity</p>
        <ul className="mt-2 space-y-0.5">
          {severities.map((s) => (
            <li key={s.id}>
              <button type="button" aria-pressed={state.sev === s.id} onClick={() => update({ sev: state.sev === s.id ? null : s.id })} className={row(state.sev === s.id)}>
                <SeverityMeter severity={s.id} className={state.sev === s.id ? "!text-black" : ""} />
                <span>{s.count}</span>
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
                <button type="button" aria-pressed={state.cat === c.id} onClick={() => update({ cat: state.cat === c.id ? null : c.id })} className={row(state.cat === c.id)}>
                  <span>{c.label}</span>
                  <span>{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {clear}
    </div>
  );
}

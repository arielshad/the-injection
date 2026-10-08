import raw from "./items.json";
import sweepsRaw from "./sweeps.json";
import {
  CATEGORY_ORDER,
  SEVERITY_ORDER,
  type Category,
  type Feed,
  type Item,
  type Severity,
} from "./schema";

/**
 * Typed accessors over the feed. The update agent never edits
 * items.json directly: scripts/finalize-sweep.ts writes it. The site
 * reads it through these helpers only.
 */

export const feed = raw as unknown as Feed;

/**
 * Newest first. `publishDate` (when the sweep ingested the item) drives
 * order, so freshly swept items float to the top. Ties (items added in
 * the same sweep) fall back to the original `date`, then severity.
 */
export const byNewest = (a: Item, b: Item): number => {
  if (a.publishDate !== b.publishDate) return a.publishDate < b.publishDate ? 1 : -1;
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
};

const sorted: Item[] = [...feed.items].sort(byNewest);
const index = new Map(sorted.map((i) => [i.id, i]));

export const allItems = (): Item[] => [...sorted];

export const itemById = (id: string): Item | undefined => index.get(id);

export const itemsByCategory = (cat: Category): Item[] =>
  sorted.filter((i) => i.categories.includes(cat));

/** Items whose PRIMARY category is `cat`. */
export const itemsByPrimaryCategory = (cat: Category): Item[] =>
  sorted.filter((i) => i.categories[0] === cat);

export const itemsBySeverity = (sev: Severity): Item[] =>
  sorted.filter((i) => i.severity === sev);

export interface FilterOptions {
  /** Item passes if ANY of its categories is in the set. Empty = no filter. */
  categories?: Set<Category>;
  /** Item passes if its severity is in the set. Empty = no filter. */
  severities?: Set<Severity>;
  /** Exact tag match (lowercase). */
  tag?: string;
  /** Free-text search across title, org, summary, tags, affected, credits, CVE. */
  query?: string;
}

const haystack = (i: Item): string =>
  [
    i.title,
    i.org,
    i.summary,
    i.explainer.tagline,
    i.tags.join(" "),
    (i.affected ?? []).join(" "),
    i.credits.map((c) => `${c.name} ${c.org ?? ""}`).join(" "),
    i.cve ?? "",
  ]
    .join(" ")
    .toLowerCase();

export const filterItems = (items: Item[], opts: FilterOptions): Item[] => {
  const q = opts.query?.trim().toLowerCase();
  const tag = opts.tag?.trim().toLowerCase();
  return items.filter((i) => {
    if (opts.categories && opts.categories.size > 0) {
      if (!i.categories.some((c) => opts.categories!.has(c))) return false;
    }
    if (opts.severities && opts.severities.size > 0) {
      if (!opts.severities.has(i.severity)) return false;
    }
    if (tag && !i.tags.includes(tag)) return false;
    if (q && !haystack(i).includes(q)) return false;
    return true;
  });
};

/** Counts each item once per category it belongs to. */
export const categoryCounts = (): Record<Category, number> => {
  const out = {} as Record<Category, number>;
  for (const i of feed.items) {
    for (const c of i.categories) out[c] = (out[c] ?? 0) + 1;
  }
  return out;
};

/** Categories with at least one item, in display order. Empty ones get no nav entry or page. */
export const activeCategories = (): Category[] => {
  const counts = categoryCounts();
  return CATEGORY_ORDER.filter((c) => (counts[c] ?? 0) > 0);
};

export const severityCounts = (): Record<Severity, number> => {
  const out = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0])) as Record<Severity, number>;
  for (const i of feed.items) out[i.severity] += 1;
  return out;
};

/** Every tag with its item count, most used first. */
export const tagCounts = (): { tag: string; count: number }[] => {
  const m = new Map<string, number>();
  for (const i of feed.items) for (const t of i.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

/**
 * Up to `n` items most related to `item`. Score: shared primary category
 * (3), each other shared category (2), each shared tag (1), each shared
 * affected product (1). Items with score 0 are never returned.
 */
export const relatedItems = (item: Item, n = 3): Item[] => {
  const cats = new Set(item.categories);
  const tags = new Set(item.tags);
  const affected = new Set((item.affected ?? []).map((a) => a.toLowerCase()));
  return sorted
    .filter((o) => o.id !== item.id)
    .map((o) => {
      let score = 0;
      if (o.categories[0] === item.categories[0]) score += 3;
      for (const c of o.categories) if (cats.has(c) && c !== item.categories[0]) score += 2;
      for (const t of o.tags) if (tags.has(t)) score += 1;
      for (const a of o.affected ?? []) if (affected.has(a.toLowerCase())) score += 1;
      return { o, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || byNewest(a.o, b.o))
    .slice(0, n)
    .map((x) => x.o);
};

// ---------------------------------------------------------------------------
// Sweep log (src/data/sweeps.json). Written only by scripts/finalize-sweep.ts.
// These types live here rather than in schema.ts because schema.ts is the
// item contract owned by the site; the sweep log is pipeline metadata.
// ---------------------------------------------------------------------------

export interface SweepAddedItem {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  /** One sentence: why it was included. */
  note: string;
}

export interface SweepUpdatedItem {
  id: string;
  title: string;
  note: string;
}

export interface SweepRemovedItem {
  id: string;
  title: string;
  reason: string;
}

export interface SweepReport {
  /** e.g. "sweep-20261007t1200z". */
  id: string;
  /** ISO timestamp. Matches the feed's generatedAt for that run. */
  timestamp: string;
  /** "github-actions-sweep", "github-actions-sweep-retry", "manual-<reason>". */
  source: string;
  promptVersion: string;
  /** 1 to 2 sentences, including what was searched when nothing was added. */
  summary: string;
  counts: { added: number; updated: number; removed: number };
  added: SweepAddedItem[];
  updated: SweepUpdatedItem[];
  removed: SweepRemovedItem[];
  /** Categories genuinely searched this run, whether or not anything was added. */
  coverage: Category[];
  /** Sources genuinely checked this run (names or URLs). */
  sourcesChecked: string[];
  /** Freshness window used for this run, in days. */
  windowDays: number;
}

export interface SweepLog {
  sweeps: SweepReport[];
}

export const sweepLog = sweepsRaw as unknown as SweepLog;

export const allSweeps = (): SweepReport[] =>
  [...sweepLog.sweeps].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

export const lastSweep = (): SweepReport | undefined => allSweeps()[0];

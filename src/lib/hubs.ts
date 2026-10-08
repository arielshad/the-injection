/**
 * Groupings behind the hub pages: products (/products/), topics (/learn/),
 * weeks (/week/) and the numbers on /stats/ and the homepage. All derived
 * from the feed at build time.
 */
import { allItems } from "@/data/feed";
import { PRODUCTS, type Product } from "@/data/products";
import { TOPIC_TAGS, type TopicTag } from "@/data/tags";
import { SEVERITY_ORDER, type Item, type Severity } from "@/data/schema";

const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);
/** Most severe first, then newest disclosure. */
export const bySeverity = (a: Item, b: Item) => rank(a.severity) - rank(b.severity) || (a.date < b.date ? 1 : -1);
const byDate = (a: Item, b: Item) => (a.date < b.date ? 1 : a.date > b.date ? -1 : rank(a.severity) - rank(b.severity));

/** A product hub needs this many stories before it gets a page. */
export const MIN_PRODUCT_STORIES = 2;

export const productsOf = (item: Item): Product[] =>
  PRODUCTS.filter((p) => (item.affected ?? []).some((a) => p.match.test(a)) || (p.tags ?? []).some((t) => item.tags.includes(t)));

export interface ProductHub { product: Product; items: Item[] }

export const productHubs = (): ProductHub[] =>
  PRODUCTS.map((product) => ({ product, items: allItems().filter((i) => productsOf(i).includes(product)).sort(byDate) }))
    .filter((h) => h.items.length >= MIN_PRODUCT_STORIES)
    .sort((a, b) => b.items.length - a.items.length || a.product.name.localeCompare(b.product.name));

/** Products of an item that have a hub page. */
export const productLinks = (item: Item): Product[] => {
  const live = new Set(productHubs().map((h) => h.product.slug));
  return productsOf(item).filter((p) => live.has(p.slug));
};

export const topicItems = (tag: TopicTag): Item[] => allItems().filter((i) => i.tags.includes(tag)).sort(byDate);

export const topicCounts = (): { tag: TopicTag; count: number }[] =>
  TOPIC_TAGS.map((tag) => ({ tag, count: topicItems(tag).length }));

// ISO 8601 weeks: Monday start, week 1 holds the year's first Thursday.
export interface Week { key: string; year: number; week: number; start: string; end: string; items: Item[] }

export function isoWeek(date: string): { year: number; week: number; start: string; end: string } {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - day + 3);
  const year = thursday.getUTCFullYear();
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - day);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { year, week, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export const weekKey = (year: number, week: number) => `${year}-w${String(week).padStart(2, "0")}`;

/** Every week with at least one disclosed story, newest first. Grouped by disclosure date, not ingest time. */
export const weeks = (): Week[] => {
  const m = new Map<string, Week>();
  for (const it of allItems()) {
    const w = isoWeek(it.date);
    const key = weekKey(w.year, w.week);
    if (!m.has(key)) m.set(key, { key, ...w, items: [] });
    m.get(key)!.items.push(it);
  }
  for (const w of m.values()) w.items.sort(bySeverity);
  return [...m.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
};

export const weekOf = (item: Item): string => {
  const w = isoWeek(item.date);
  return weekKey(w.year, w.week);
};

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Most-hit products in a set of items, with hub pages only. */
export const topProducts = (items: Item[], n = 3): { product: Product; count: number }[] => {
  const live = new Set(productHubs().map((h) => h.product.slug));
  const c = new Map<string, { product: Product; count: number }>();
  for (const it of items) for (const p of productsOf(it)) if (live.has(p.slug)) c.set(p.slug, { product: p, count: (c.get(p.slug)?.count ?? 0) + 1 });
  return [...c.values()].sort((a, b) => b.count - a.count || a.product.name.localeCompare(b.product.name)).slice(0, n);
};

/**
 * One plain paragraph answering "what happened in AI security lately?",
 * for the homepage and week pages. Built from counts, never from opinion.
 */
export function digestSentence(items: Item[], span: string): string {
  if (items.length === 0) return `No AI security stories were disclosed ${span}.`;
  const serious = items.filter((i) => i.severity === "critical" || i.severity === "high");
  const top = [...items].sort(bySeverity).slice(0, 2).map((i) => `"${i.title}"`);
  const cves = items.filter((i) => i.cve).length;
  const prods = topProducts(items).map((p) => `${p.product.name} (${p.count})`);
  return [
    `${span[0].toUpperCase()}${span.slice(1)}, The Injection tracked ${plural(items.length, "AI security story", "AI security stories")}`,
    serious.length ? `, ${serious.length} of them rated high or critical` : "",
    `, including ${list(top)}.`,
    cves ? ` ${plural(cves, "story", "stories")} came with a CVE.` : "",
    prods.length ? ` Most affected: ${list(prods)}.` : "",
  ].join("");
}

/** The window the homepage summary covers: 7 days, widened to 30 if the week was quiet. */
export function recentWindow(now: string): { items: Item[]; span: string; days: number } {
  const since = (days: number) => {
    const t = new Date(now).getTime() - days * 86400000;
    return allItems().filter((i) => new Date(`${i.date}T12:00:00Z`).getTime() >= t);
  };
  const week = since(7);
  return week.length >= 3 ? { items: week, span: "in the last 7 days", days: 7 } : { items: since(30), span: "in the last 30 days", days: 30 };
}

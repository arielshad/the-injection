import type { Item } from "@/data/schema";
import type { SlimItem } from "@/components/FeedExplorer";

/** What the client island needs, and nothing else: keeps the page payload small. */
export const slim = (it: Item): SlimItem => ({
  id: it.id,
  title: it.title,
  summary: it.summary,
  org: it.org,
  date: it.date,
  severity: it.severity,
  categories: it.categories,
  credits: it.credits.map((c) => c.name),
  tags: it.tags,
  cve: it.cve,
  image: it.image?.url,
  coverText: (() => { const p = it.cve ?? it.affected?.[0] ?? it.org; return p.length > 18 ? (it.affected?.find((a) => a.length <= 18) ?? it.org) : p; })(),
});

export const fmtDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });

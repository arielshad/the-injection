/**
 * Pre-sweep briefing. Prints JSON to stdout:
 *   { now, windowDays, oldestAllowedDate, feedSize, existing[] }
 *
 * It tells the agent the time, the freshness window and what is already in
 * the feed (the do-not-add-twice list). Nothing else. No category gaps, no
 * "this category is quiet" hints: the agent reads any such signal as a quota
 * and pads the feed to fill it (ai-tldr SWEEP_MEMORY 2026-04-28-B/C).
 *
 * Usage: npx tsx scripts/sweep-context.ts [--window-days N]
 */
import type { Feed } from "../src/data/schema.ts";
import { DEFAULT_WINDOW_DAYS, ITEMS_PATH, canonUrl, normId, readJson } from "./lib/common.ts";

const args = process.argv.slice(2);
const wi = args.indexOf("--window-days");
const windowDays = wi >= 0 ? Number(args[wi + 1]) : DEFAULT_WINDOW_DAYS;

const feed = readJson<Feed>(ITEMS_PATH);
const now = new Date();
const oldest = new Date(now.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10);

const out = {
  now: now.toISOString(),
  windowDays,
  /** Items with `date` before this are rejected by finalize-sweep. */
  oldestAllowedDate: oldest,
  feedSize: feed.items.length,
  // finalize-sweep hard-fails on any id, normalized-id or canonical-URL
  // collision with this list. Semantic dedup (same story, other URL) is
  // the agent's job: read every title and affected list.
  existing: feed.items.map((i) => ({
    id: i.id,
    normId: normId(i.id),
    url: canonUrl(i.url),
    title: i.title,
    date: i.date,
    cve: i.cve,
    affected: i.affected,
  })),
};

console.log(JSON.stringify(out, null, 2));

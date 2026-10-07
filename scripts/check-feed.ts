/**
 * Build gate for the content. Runs before `astro build` (see package.json).
 *
 * Fails (exit 1) on:
 *   - duplicate ids, normalized ids, canonical urls or CVEs
 *   - any item failing schema/house-style validation in "feed" mode:
 *     required fields, category/severity enums, title <= 80, summary <= 240,
 *     credits non-empty, >= 2 links, https urls, kebab ids/tags, no em dashes,
 *     image (when present) = { https url, non-empty alt, optional credit }
 *   - a malformed items.json or sweeps.json envelope
 *
 * Warns (exit 0) on: banned hype words, exclamation marks, emoji, faq length,
 * critical/high items without quickFacts/faq, image urls that look like a
 * logo or default social card.
 *
 * Usage: npx tsx scripts/check-feed.ts [--strict]   (--strict turns warnings into errors)
 */
import type { Feed } from "../src/data/schema.ts";
import type { SweepLog } from "../src/data/feed.ts";
import { ITEMS_PATH, SWEEPS_PATH, canonUrl, normId, readJson, validateItem } from "./lib/common.ts";

const strict = process.argv.includes("--strict");
const errors: string[] = [];
const warnings: string[] = [];

let feed: Feed;
let log: SweepLog;
try {
  feed = readJson<Feed>(ITEMS_PATH);
  log = readJson<SweepLog>(SWEEPS_PATH);
} catch (err) {
  console.error(`check-feed: cannot parse data files: ${(err as Error).message}`);
  process.exit(1);
}

if (!Array.isArray(feed.items)) errors.push("items.json: `items` must be an array");
if (typeof feed.generatedAt !== "string" || Number.isNaN(Date.parse(feed.generatedAt)))
  errors.push("items.json: `generatedAt` must be an ISO timestamp");
if (typeof feed.promptVersion !== "string") errors.push("items.json: `promptVersion` must be a string");
if (!Array.isArray(log.sweeps)) errors.push("sweeps.json: `sweeps` must be an array");

const items = Array.isArray(feed.items) ? feed.items : [];

for (const it of items) {
  const r = validateItem(it, "feed");
  errors.push(...r.errors);
  warnings.push(...r.warnings);
}

const dupes = (label: string, key: (i: (typeof items)[number]) => string | undefined) => {
  const m = new Map<string, string[]>();
  for (const i of items) {
    const k = key(i);
    if (k) m.set(k, [...(m.get(k) ?? []), i.id]);
  }
  for (const [k, ids] of m) if (ids.length > 1) errors.push(`duplicate ${label} "${k}": ${ids.join(", ")}`);
};
dupes("id", (i) => i.id);
dupes("normalized id", (i) => normId(i.id ?? ""));
dupes("canonical url", (i) => (i.url ? canonUrl(i.url) : undefined));
dupes("cve", (i) => i.cve?.toUpperCase());

for (const s of Array.isArray(log.sweeps) ? log.sweeps : []) {
  if (!s.id || !s.timestamp || !s.counts || !Array.isArray(s.added))
    errors.push(`sweeps.json: malformed report ${JSON.stringify(s.id)}`);
}

if (warnings.length > 0) {
  console.error(`check-feed: ${warnings.length} warning(s):`);
  for (const w of warnings) console.error(`  ~ ${w}`);
}
if (errors.length > 0 || (strict && warnings.length > 0)) {
  console.error(`check-feed FAILED: ${errors.length} error(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  console.error("Fix the data through a sweep draft (updates[]), never by hand-editing around the check.");
  process.exit(1);
}
console.log(`check-feed ok: ${items.length} items, ${log.sweeps.length} sweeps, no duplicates, schema valid`);

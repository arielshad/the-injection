/**
 * Merge a verified sweep draft into src/data/items.json and append a report
 * to src/data/sweeps.json. The agent never edits those files by hand.
 *
 * Usage:
 *   npx tsx scripts/finalize-sweep.ts [draft-path] [--source <label>] [--window-days N]
 *
 * Defaults: draft sweep-draft.json, source "github-actions-sweep", window 7 days.
 * Use --source manual-<reason> for hand-run sweeps. Widening --window-days is
 * for seeding/backfill only and must be logged in SWEEP_MEMORY.md.
 *
 * Hard fails (exit 1, nothing written):
 *   - draft item fails schema/house-style validation (see scripts/lib/common.ts)
 *   - credits empty, or fewer than 2 links
 *   - `date` older than the window (date = original disclosure date)
 *   - id, normalized-id or canonical-URL collision with the feed or the draft
 *   - CVE collision with an existing item (same flaw twice)
 *   - coverage or sourcesChecked empty, or coverage holds a non-category
 *   - update/removal targets that do not exist
 *   - any item in the merged feed fails validation
 *
 * Soft warnings (stderr, exit 0): missing quickFacts/faq on critical/high,
 * more than 2 critical or more than 2 research-primary items in one sweep,
 * banned words, faq answer length.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CATEGORY_ORDER, type Category, type Feed, type Item } from "../src/data/schema.ts";
import type { SweepLog, SweepReport } from "../src/data/feed.ts";
import {
  DEFAULT_DRAFT,
  DEFAULT_WINDOW_DAYS,
  ITEMS_PATH,
  SWEEPS_PATH,
  canonUrl,
  normId,
  promptVersion,
  readJson,
  validateItem,
  writeJson,
} from "./lib/common.ts";

// ---- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const sourceLabel = flag("--source") ?? "github-actions-sweep";
const windowDays = Number(flag("--window-days") ?? DEFAULT_WINDOW_DAYS);
if (!Number.isFinite(windowDays) || windowDays <= 0) {
  console.error(`invalid --window-days: ${flag("--window-days")}`);
  process.exit(1);
}
const valueIdx = new Set<number>();
for (const f of ["--source", "--window-days"]) {
  const i = args.indexOf(f);
  if (i >= 0) valueIdx.add(i + 1);
}
const positional = args.find((a, i) => !a.startsWith("--") && !valueIdx.has(i));
const draftPath = positional ? resolve(positional) : DEFAULT_DRAFT;
if (!existsSync(draftPath)) {
  console.error(`draft not found: ${draftPath}`);
  process.exit(1);
}

interface Draft {
  newItems?: Item[];
  updates?: { id: string; patch: Partial<Item>; note?: string }[];
  removals?: { id: string; reason: string }[];
  summary?: string;
  coverage?: Category[];
  sourcesChecked?: string[];
  notes?: Record<string, string>;
}

const draft = readJson<Draft>(draftPath);
const newItems = draft.newItems ?? [];
const updates = draft.updates ?? [];
const removals = draft.removals ?? [];
const feed = readJson<Feed>(ITEMS_PATH);
const log = readJson<SweepLog>(SWEEPS_PATH);

const errors: string[] = [];
const warnings: string[] = [];

// ---- 1. sweep-level fields ----------------------------------------------------
if (!draft.summary?.trim()) errors.push("draft.summary is required (say what was searched, even on an empty sweep)");
if (!Array.isArray(draft.coverage) || draft.coverage.length === 0)
  errors.push("draft.coverage must list the categories you searched (required on empty sweeps too)");
else
  for (const c of draft.coverage)
    if (!CATEGORY_ORDER.includes(c)) errors.push(`draft.coverage: "${c}" is not a category (sources go in sourcesChecked)`);
if (!Array.isArray(draft.sourcesChecked) || draft.sourcesChecked.length === 0)
  errors.push("draft.sourcesChecked must list the sources you actually checked");

// ---- 2. item validation ---------------------------------------------------------
const now = Date.now();
for (const it of newItems) {
  const r = validateItem(it, "draft");
  errors.push(...r.errors);
  warnings.push(...r.warnings);
  if (!Array.isArray(it.credits) || it.credits.length === 0) errors.push(`${it.id}: HARD RULE credits is empty`);
  if (!Array.isArray(it.links) || it.links.length < 2) errors.push(`${it.id}: HARD RULE needs >= 2 links`);
  if (it.date) {
    const ageDays = (now - Date.parse(`${it.date}T00:00:00Z`)) / 86_400_000;
    if (ageDays > windowDays + 1)
      errors.push(
        `${it.id}: date ${it.date} is ${Math.floor(ageDays)} days old (window ${windowDays} days). ` +
          "Old disclosures stay out, even if people are still talking about them.",
      );
  }
}

// ---- 3. collisions --------------------------------------------------------------
const byId = new Map(feed.items.map((i) => [i.id, i]));
const byNorm = new Map(feed.items.map((i) => [normId(i.id), i.id]));
const byUrl = new Map(feed.items.map((i) => [canonUrl(i.url), i.id]));
const byCve = new Map(feed.items.filter((i) => i.cve).map((i) => [i.cve!.toUpperCase(), i.id]));
const removing = new Set(removals.map((r) => r.id));
for (const it of newItems) {
  if (byId.has(it.id)) errors.push(`${it.id}: id already in the feed. Use updates[] instead.`);
  const n = byNorm.get(normId(it.id));
  if (n && n !== it.id) errors.push(`${it.id}: normalizes to the same slug as existing "${n}"`);
  const u = byUrl.get(canonUrl(it.url));
  if (u && u !== it.id && !removing.has(u)) errors.push(`${it.id}: same canonical url as existing "${u}"`);
  const c = it.cve ? byCve.get(it.cve.toUpperCase()) : undefined;
  if (c && !removing.has(c)) errors.push(`${it.id}: ${it.cve} is already covered by "${c}". Use updates[].`);
  // collisions inside the draft itself
  byNorm.set(normId(it.id), it.id);
  byUrl.set(canonUrl(it.url), it.id);
  if (it.cve) byCve.set(it.cve.toUpperCase(), it.id);
}
for (const u of updates) if (!byId.has(u.id)) errors.push(`updates: "${u.id}" not found in feed`);
for (const r of removals) if (!byId.has(r.id)) errors.push(`removals: "${r.id}" not found in feed`);

if (errors.length > 0) {
  console.error(`finalize-sweep FAILED (${errors.length} error(s)); nothing was written:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ---- 4. build the new feed in memory ----------------------------------------------
const generatedAt = new Date().toISOString();
const stamped: Item[] = newItems.map((i) => ({ ...i, publishDate: generatedAt }));

const updatedReports: SweepReport["updated"] = [];
for (const u of updates) {
  const target = byId.get(u.id)!;
  const { publishDate: _ignored, id: _id, ...patch } = u.patch as Partial<Item>;
  Object.assign(target, patch);
  updatedReports.push({ id: u.id, title: target.title, note: u.note ?? "updated" });
}
const removedReports: SweepReport["removed"] = removals.map((r) => ({
  id: r.id,
  title: byId.get(r.id)!.title,
  reason: r.reason,
}));

const items = [...feed.items.filter((i) => !removing.has(i.id)), ...stamped].sort((a, b) => {
  if (a.publishDate !== b.publishDate) return a.publishDate < b.publishDate ? 1 : -1;
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
});

// whole-feed validation before anything touches disk
const post: string[] = [];
for (const it of items) post.push(...validateItem(it, "feed").errors);
const ids = items.map((i) => i.id);
if (new Set(ids).size !== ids.length) post.push("merged feed has duplicate ids");
if (post.length > 0) {
  console.error("finalize-sweep FAILED: merged feed is invalid; nothing was written:");
  for (const e of post) console.error(`  - ${e}`);
  process.exit(1);
}

// ---- 5. soft warnings -------------------------------------------------------------
const crit = stamped.filter((i) => i.severity === "critical").length;
if (crit > 2) warnings.push(`severity inflation: ${crit} critical items in one sweep. Re-read the rubric.`);
const papers = stamped.filter((i) => i.categories[0] === "research").length;
if (papers > 2)
  warnings.push(`paper cap: ${papers} research-primary items in one sweep (soft cap 2). Keep the strongest two.`);

// ---- 6. write -----------------------------------------------------------------------
const version = promptVersion();
const nextFeed: Feed = { generatedAt, promptVersion: version, items };
writeJson(ITEMS_PATH, nextFeed);

const sweepId = `sweep-${generatedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").toLowerCase()}`;
const report: SweepReport = {
  id: sweepId,
  timestamp: generatedAt,
  source: sourceLabel,
  promptVersion: version,
  summary: draft.summary!.trim(),
  counts: { added: stamped.length, updated: updatedReports.length, removed: removedReports.length },
  added: stamped.map((i) => ({
    id: i.id,
    title: i.title,
    category: i.categories[0],
    severity: i.severity,
    note: draft.notes?.[i.id] ?? `Added under ${i.categories[0]}.`,
  })),
  updated: updatedReports,
  removed: removedReports,
  coverage: draft.coverage!,
  sourcesChecked: draft.sourcesChecked!,
  windowDays,
};
log.sweeps.push(report);
writeJson(SWEEPS_PATH, log);

console.log(
  JSON.stringify(
    {
      ok: true,
      sweepId,
      generatedAt,
      added: stamped.length,
      updated: updatedReports.length,
      removed: removedReports.length,
      feedSize: items.length,
      windowDays,
      warnings,
    },
    null,
    2,
  ),
);
if (warnings.length > 0) {
  console.error(`finalize-sweep completed with ${warnings.length} warning(s):`);
  for (const w of warnings) console.error(`  - ${w}`);
}

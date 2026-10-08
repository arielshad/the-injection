/**
 * Per-category drought alarm, for humans only.
 *
 * Why: a category with no discovery source goes silent and nobody notices.
 * `tool` sat at one item here because nothing pointed the sweep at GitHub
 * (SWEEP_MEMORY 2026-10-08-A). ai-tldr had `dataset` and `algorithm` dead for
 * 48 days the same way (its 2026-06-13-B) and added a drought warning.
 *
 * Why it runs AFTER the agent, in its own workflow step: any gap signal the
 * agent can see becomes a quota, and quotas become padding (SWEEP_MEMORY
 * "Gap signals become quotas"). ai-tldr put its alarm in finalize-sweep,
 * whose output the agent reads. Here only the Actions log and run summary
 * show it. Never call this from the prompt, sweep-context or finalize.
 *
 * The clock is `publishDate` (when we ingested an item), not `date`.
 * A drought is a reason to check that category's discovery source, never a
 * reason to lower the bar. Always exits 0.
 *
 * Usage: npx tsx scripts/drought-check.ts
 */
import { appendFileSync } from "node:fs";
import type { Category, Feed } from "../src/data/schema.ts";
import { CATEGORY_ORDER } from "../src/data/schema.ts";
import { ITEMS_PATH, readJson } from "./lib/common.ts";

/** Days without a new item before we look at the discovery source. */
const DROUGHT_DAYS: Record<Category, number> = {
  vulnerability: 7,
  attack: 10,
  "supply-chain": 10,
  research: 10,
  incident: 14,
  tool: 14,
  benchmark: 21,
  "lab-safety": 21,
  talk: 30,
};

const feed = readJson<Feed>(ITEMS_PATH);
const now = Date.now();
const rows = CATEGORY_ORDER.map((cat) => {
  const last = feed.items
    .filter((i) => i.categories.includes(cat))
    .reduce((max, i) => Math.max(max, Date.parse(i.publishDate) || 0), 0);
  const days = last ? Math.floor((now - last) / 86_400_000) : null;
  const limit = DROUGHT_DAYS[cat];
  return { cat, days, limit, dry: days === null || days > limit };
});

const ci = process.env.GITHUB_ACTIONS === "true";
for (const r of rows.filter((r) => r.dry)) {
  const msg =
    `${r.cat}: ${r.days === null ? "no items ever" : `${r.days}d since the last new item`} ` +
    `(alarm at ${r.limit}d). Check this category's discovery source; do not lower the bar.`;
  console.log(ci ? `::warning title=Category drought::${msg}` : `drought ${msg}`);
}
if (!rows.some((r) => r.dry)) console.log("drought-check: every category had a new item inside its limit.");

if (process.env.GITHUB_STEP_SUMMARY) {
  const table = [
    "## Category freshness (humans only, never shown to the sweep agent)",
    "",
    "| Category | Days since last new item | Alarm at | Status |",
    "|---|---|---|---|",
    ...rows.map((r) => `| ${r.cat} | ${r.days ?? "never"} | ${r.limit} | ${r.dry ? "check source" : "ok"} |`),
    "",
  ].join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
}

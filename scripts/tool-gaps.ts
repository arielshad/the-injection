/**
 * Gap finder for the tools directory (src/data/tools.json).
 *
 * Why: a directory built from what a model remembers misses the tools it does
 * not recall, even the most-starred ones. ai-tldr found 230 popular AI repos
 * missing from its "complete" landscape this way (its SWEEP_MEMORY
 * 2026-06-15-A) and fixed it by diffing against GitHub's own top repos.
 *
 * Two jobs:
 *   1. missing[]: the most-starred AI security repos (all time, same queries as
 *      repo-scan) that the directory does not list, minus forks, archived
 *      repos and non-tools. Candidates only: prompts/maintain-tools.md decides.
 *   2. listed[]: every listed tool's current state from the GitHub API
 *      (archived, renamed or moved, last push), so stale entries get fixed.
 *
 * Usage: npx tsx scripts/tool-gaps.ts [--min-stars N]   (default 300)
 * Prints JSON: { minStars, queriesRun, queriesFailed[], missing[], listed[] }
 * Exit 0 when at least one query ran, 1 otherwise. Reads GITHUB_TOKEN.
 */
import { resolve } from "node:path";
import type { ToolRegistry } from "../src/data/schema.ts";
import { ROOT, readJson } from "./lib/common.ts";
import { AI_SECURITY_QUERIES, PACE_MS, githubHeaders, notAToolReason, searchRepos, sleep } from "./lib/github.ts";

const i = process.argv.indexOf("--min-stars");
const minStars = i >= 0 ? Number(process.argv[i + 1]) : 300;
const reg = readJson<ToolRegistry>(resolve(ROOT, "src/data/tools.json"));
const listedRepos = new Set(reg.tools.map((t) => t.repo.toLowerCase()));

const missing = new Map<string, { repo: string; url: string; stars: number; pushedAt: string | null; license: string | null; description: string | null; matchedBy: string[] }>();
const queriesFailed: { query: string; error: string }[] = [];
let queriesRun = 0;

for (const [n, query] of AI_SECURITY_QUERIES.entries()) {
  if (n > 0) await sleep(PACE_MS);
  try {
    const items = await searchRepos(`${query} stars:>=${minStars} fork:false archived:false`);
    queriesRun++;
    for (const r of items) {
      const key = r.full_name.toLowerCase();
      if (listedRepos.has(key) || r.fork || r.archived || r.is_template) continue;
      if (notAToolReason(`${r.full_name} ${r.description ?? ""}`)) continue;
      const prev = missing.get(key);
      if (prev) prev.matchedBy.push(query);
      else
        missing.set(key, {
          repo: r.full_name,
          url: r.html_url,
          stars: r.stargazers_count,
          pushedAt: r.pushed_at ?? null,
          license: r.license?.spdx_id ?? null,
          description: r.description,
          matchedBy: [query],
        });
    }
  } catch (err) {
    queriesFailed.push({ query, error: (err as Error).message });
  }
}

// Current state of every listed tool. A rename or transfer shows as a different full_name.
const listed = [];
for (const t of reg.tools) {
  try {
    const res = await fetch(`https://api.github.com/repos/${t.repo}`, { headers: githubHeaders, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      listed.push({ slug: t.slug, repo: t.repo, status: `HTTP ${res.status}` });
      continue;
    }
    const r = (await res.json()) as { full_name: string; archived: boolean; pushed_at: string; license?: { spdx_id?: string } | null };
    listed.push({
      slug: t.slug,
      repo: t.repo,
      status: r.archived ? "archived" : r.full_name.toLowerCase() !== t.repo.toLowerCase() ? `moved to ${r.full_name}` : "ok",
      pushedAt: r.pushed_at,
      license: r.license?.spdx_id ?? null,
    });
  } catch (err) {
    listed.push({ slug: t.slug, repo: t.repo, status: (err as Error).message });
  }
}

console.log(
  JSON.stringify(
    { minStars, queriesRun, queriesFailed, missing: [...missing.values()].sort((a, b) => b.stars - a.stars), listed },
    null,
    2,
  ),
);
if (queriesRun === 0) {
  console.error("tool-gaps: every GitHub search failed (rate limit or network).");
  process.exit(1);
}

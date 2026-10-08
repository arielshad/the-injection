/**
 * Discovery feed for new open-source AI security repos.
 *
 * Why it exists: without it, the sweep only met a new repo when a blog or
 * HN happened to mention it, and the model cannot recall a repo created this
 * week. ai-tldr hit the same blind spot (its SWEEP_MEMORY 2026-06-15-A): its
 * tool list came from model memory and missed the most-starred repos on
 * GitHub. The fix there, and here, is to ask GitHub directly.
 *
 * Runs a fixed set of GitHub searches for repos CREATED inside the window,
 * sorted by stars, drops forks, archived repos and obvious non-tools
 * (awesome-lists, prompt and jailbreak dumps, leaked system prompts, courses),
 * merges and dedups, and prints candidates. A candidate is a place to look,
 * not an item: every one still goes through gh-repo-meta.ts, a README read
 * and the repo bar in prompts/update-feed.md. An empty list is normal.
 *
 * Usage: npx tsx scripts/repo-scan.ts [--window-days N] [--min-stars N]
 *
 * Prints JSON on stdout:
 *   { createdSince, minStars, queriesRun, queriesFailed[], candidates[], skipped[] }
 * each candidate: { fullName, url, stars, createdAt, description, topics[],
 *                   ownerType, matchedBy[] }
 *
 * Reads GITHUB_TOKEN when set. Unauthenticated search allows 10 requests a
 * minute, so the script paces itself (about 85s without a token).
 * Exit 0 when at least one query ran, 1 when every query failed.
 */
import { DEFAULT_WINDOW_DAYS } from "./lib/common.ts";

const args = process.argv.slice(2);
const flag = (name: string, dflt: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const windowDays = flag("--window-days", DEFAULT_WINDOW_DAYS);
// Low on purpose: this only builds the candidate list. The repo bar in the
// prompt decides what ships, and small repos from known teams can qualify.
const minStars = flag("--min-stars", 20);
const createdSince = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);

/** Both beats: attacks on AI, and the security of building with AI. */
const QUERIES = [
  "topic:ai-security",
  "topic:llm-security",
  "topic:prompt-injection",
  "topic:ai-red-teaming",
  "topic:llm-guardrails",
  "topic:mcp-security",
  "topic:agent-security",
  '"prompt injection" in:name,description',
  '"LLM security" in:name,description',
  '"AI red team" in:name,description',
  '"MCP scanner" in:name,description',
  '"MCP security" in:name,description',
  '"agent sandbox" in:name,description',
];

/** Not tools and not news. Matched against name and description. */
const NOT_A_TOOL: [RegExp, string][] = [
  [/awesome/i, "curated list"],
  [/\b(leaked[- ]?(system[- ]?)?prompts?|system[- ]?prompts? (of|from|for) )/i, "leaked prompts"],
  [/\b(jailbreak[- ]?prompts?|prompt[- ]?collection|prompt[- ]?list)\b/i, "prompt dump"],
  [/\b(course|tutorial|cookbook|handbook|cheat[- ]?sheet|roadmap|reading[- ]?list|papers?[- ]?list|interview)\b/i, "learning material"],
  [/\b(homework|assignment|bootcamp|workshop|study[- ]?notes)\b/i, "coursework"],
];

const headers: Record<string, string> = {
  "User-Agent": "TheInjectionSweep/1.0",
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const PACE_MS = process.env.GITHUB_TOKEN ? 2_100 : 6_500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SearchRepo {
  full_name: string;
  html_url: string;
  stargazers_count: number;
  created_at: string;
  description: string | null;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  is_template?: boolean;
  owner: { type: string };
}

interface Candidate {
  fullName: string;
  url: string;
  stars: number;
  createdAt: string;
  description: string | null;
  topics: string[];
  ownerType: string;
  matchedBy: string[];
}

const found = new Map<string, Candidate>();
const skipped = new Map<string, string>();
const queriesFailed: { query: string; error: string }[] = [];
let queriesRun = 0;

for (const [n, query] of QUERIES.entries()) {
  if (n > 0) await sleep(PACE_MS);
  const q = `${query} created:>=${createdSince} stars:>=${minStars} fork:false archived:false`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { items: SearchRepo[] };
    queriesRun++;
    for (const r of data.items) {
      if (r.fork || r.archived || r.is_template) continue;
      const text = `${r.full_name} ${r.description ?? ""}`;
      const reason = NOT_A_TOOL.find(([re]) => re.test(text))?.[1];
      if (reason) {
        skipped.set(r.full_name, reason);
        continue;
      }
      const prev = found.get(r.full_name);
      if (prev) {
        prev.matchedBy.push(query);
        continue;
      }
      found.set(r.full_name, {
        fullName: r.full_name,
        url: r.html_url,
        stars: r.stargazers_count,
        createdAt: r.created_at,
        description: r.description,
        topics: r.topics ?? [],
        ownerType: r.owner.type,
        matchedBy: [query],
      });
    }
  } catch (err) {
    queriesFailed.push({ query, error: (err as Error).message });
  }
}

const out = {
  createdSince,
  minStars,
  queriesRun,
  queriesFailed,
  candidates: [...found.values()].sort((a, b) => b.stars - a.stars),
  skipped: [...skipped].map(([fullName, reason]) => ({ fullName, reason })),
};
console.log(JSON.stringify(out, null, 2));
if (queriesRun === 0) {
  console.error("repo-scan: every GitHub search failed (rate limit or network). Say so in the sweep summary.");
  process.exit(1);
}

/**
 * Discovery feed for new AI security papers, with the signals the paper bar
 * in prompts/update-feed.md asks for already extracted.
 *
 * Why it exists: "search arXiv" left the agent to judge each paper from its
 * abstract, and a paper with a GitHub link passed a one-signal bar. ai-tldr
 * hit the same thing (its SWEEP_MEMORY 2026-04-28-B: 11 of 108 items were
 * arXiv papers) and moved to a two-signal bar. This script finds the papers
 * and reads three signals deterministically:
 *   - code:  a GitHub, GitLab or Hugging Face link in the arXiv comment or abstract
 *   - venue: "accepted at/to/by <top venue>" in the comment ("submitted to" does not count)
 *   - hf:    upvotes on Hugging Face Daily Papers
 * The other signals (named product attacked, vendor confirmed or fixed,
 * known team, HN or researcher discussion) are the agent's to check.
 *
 * Usage: npx tsx scripts/paper-scan.ts [--window-days N]
 *
 * Prints JSON on stdout:
 *   { since, queriesRun, queriesFailed[], hfDaysRead, candidates[] }
 * each candidate: { arxivId, title, authors[], published, primaryCategory,
 *                   absUrl, abstract, comment, signals: { codeUrl, venue,
 *                   hfUpvotes }, scannedSignals, matchedBy[] }
 * sorted by scannedSignals, then hfUpvotes. `published` is the v1 date: use
 * it as the item `date`.
 *
 * Exit 0 when at least one arXiv query ran, 1 otherwise.
 */
import { DEFAULT_WINDOW_DAYS } from "./lib/common.ts";

const args = process.argv.slice(2);
const wi = args.indexOf("--window-days");
const windowDays = wi >= 0 ? Number(args[wi + 1]) : DEFAULT_WINDOW_DAYS;
const sinceMs = Date.now() - windowDays * 86_400_000;
const since = new Date(sinceMs).toISOString().slice(0, 10);

const CATS = "(cat:cs.CR OR cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.SE)";
/** Both beats. Each is ANDed with CATS and the date range. */
const QUERIES = [
  'abs:"prompt injection"',
  "abs:jailbreak",
  'abs:"LLM agent" AND (abs:attack OR abs:security OR abs:vulnerab*)',
  'abs:"coding agent" AND (abs:attack OR abs:security OR abs:vulnerab*)',
  '(abs:"Model Context Protocol" OR abs:MCP) AND (abs:attack OR abs:security)',
  'abs:backdoor AND (abs:LLM OR abs:"language model")',
  'abs:poisoning AND (abs:LLM OR abs:"language model" OR abs:RAG)',
  '(abs:guardrail OR abs:"red teaming") AND (abs:LLM OR abs:agent)',
  'abs:"AI-generated code" AND (abs:vulnerab* OR abs:security)',
];

/** Top venues for this beat. A workshop at any of them does not count. */
const VENUES: [RegExp, string][] = [
  [/usenix\s+security/i, "USENIX Security"],
  [/\b(ieee\s+)?(s\s*&\s*p|symposium on security and privacy|oakland)\b/i, "IEEE S&P"],
  [/\b(acm\s+)?ccs\b/i, "ACM CCS"],
  [/\bndss\b/i, "NDSS"],
  [/\bsatml\b/i, "SaTML"],
  [/\bneurips\b/i, "NeurIPS"],
  [/\bicml\b/i, "ICML"],
  [/\biclr\b/i, "ICLR"],
  [/\bacl\b/i, "ACL"],
  [/\bemnlp\b/i, "EMNLP"],
  [/\bnaacl\b/i, "NAACL"],
];
const ACCEPTED = /\b(accepted|to appear|camera[- ]ready|published)\b/i;
const CODE = /https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|huggingface\.co)\/[^\s,;)\]}]+/i;

const UA = "TheInjectionSweep/1.0 (paper-scan; +https://github.com/)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymdhm = (ms: number) => new Date(ms).toISOString().replace(/[-:T]/g, "").slice(0, 12);

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : null;
};

interface Candidate {
  arxivId: string;
  title: string;
  authors: string[];
  published: string;
  primaryCategory: string | null;
  absUrl: string;
  abstract: string;
  comment: string | null;
  signals: { codeUrl: string | null; venue: string | null; hfUpvotes: number | null };
  scannedSignals: number;
  matchedBy: string[];
}

function venueOf(comment: string | null): string | null {
  if (!comment || !ACCEPTED.test(comment) || /workshop/i.test(comment)) return null;
  return VENUES.find(([re]) => re.test(comment))?.[1] ?? null;
}

const found = new Map<string, Candidate>();
const queriesFailed: { query: string; error: string }[] = [];
let queriesRun = 0;

const range = `submittedDate:[${ymdhm(sinceMs)} TO ${ymdhm(Date.now())}]`;
for (const [n, q] of QUERIES.entries()) {
  // arXiv asks API clients to wait 3 seconds between calls.
  if (n > 0) await sleep(3_100);
  const search = `${CATS} AND (${q}) AND ${range}`;
  const url =
    "https://export.arxiv.org/api/query?search_query=" +
    encodeURIComponent(search) +
    "&sortBy=submittedDate&sortOrder=descending&max_results=100";
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    queriesRun++;
    for (const entry of xml.split("<entry>").slice(1)) {
      const idUrl = tag(entry, "id") ?? "";
      const arxivId = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
      const published = tag(entry, "published") ?? "";
      if (!arxivId || Date.parse(published) < sinceMs) continue; // v1 outside the window
      const prev = found.get(arxivId);
      if (prev) {
        prev.matchedBy.push(q);
        continue;
      }
      const abstract = tag(entry, "summary") ?? "";
      const comment = tag(entry, "arxiv:comment");
      const codeUrl = (comment?.match(CODE) ?? abstract.match(CODE))?.[0]?.replace(/[.]+$/, "") ?? null;
      found.set(arxivId, {
        arxivId,
        title: tag(entry, "title") ?? "",
        authors: [...entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g)].map((m) => decode(m[1])),
        published: published.slice(0, 10),
        primaryCategory: entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)?.[1] ?? null,
        absUrl: `https://arxiv.org/abs/${arxivId}`,
        abstract: abstract.length > 600 ? `${abstract.slice(0, 600)}...` : abstract,
        comment,
        signals: { codeUrl, venue: venueOf(comment), hfUpvotes: null },
        scannedSignals: 0,
        matchedBy: [q],
      });
    }
  } catch (err) {
    queriesFailed.push({ query: q, error: (err as Error).message });
  }
}

// Hugging Face Daily Papers, one call per day in the window.
let hfDaysRead = 0;
for (let d = 0; d <= windowDays; d++) {
  const day = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  try {
    const res = await fetch(`https://huggingface.co/api/daily_papers?date=${day}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) continue;
    hfDaysRead++;
    for (const p of (await res.json()) as { paper?: { id?: string; upvotes?: number } }[]) {
      const c = p.paper?.id ? found.get(p.paper.id) : undefined;
      if (c) c.signals.hfUpvotes = Math.max(c.signals.hfUpvotes ?? 0, p.paper?.upvotes ?? 0);
    }
  } catch {
    /* one missing day is fine */
  }
}

for (const c of found.values())
  c.scannedSignals = [c.signals.codeUrl, c.signals.venue, (c.signals.hfUpvotes ?? 0) >= 20 || null].filter(Boolean).length;

const candidates = [...found.values()].sort(
  (a, b) => b.scannedSignals - a.scannedSignals || (b.signals.hfUpvotes ?? 0) - (a.signals.hfUpvotes ?? 0),
);
console.log(JSON.stringify({ since, queriesRun, queriesFailed, hfDaysRead, candidates }, null, 2));
if (queriesRun === 0) {
  console.error("paper-scan: every arXiv query failed. Search arXiv by hand and say so in the summary.");
  process.exit(1);
}

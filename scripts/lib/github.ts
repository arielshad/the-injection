/**
 * GitHub search pieces shared by repo-scan.ts (new repos for the feed) and
 * tool-gaps.ts (popular repos missing from the tools directory).
 * Reads GITHUB_TOKEN when set. Unauthenticated search allows 10 requests a
 * minute, authenticated 30: PACE_MS keeps under either.
 */

/** Both beats: attacks on AI, and the security of building with AI. */
export const AI_SECURITY_QUERIES = [
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

/** Not tools and not news. Matched against "owner/name description". */
export const NOT_A_TOOL: [RegExp, string][] = [
  [/awesome/i, "curated list"],
  [/\b(leaked[- ]?(system[- ]?)?prompts?|system[- ]?prompts? (of|from|for) )/i, "leaked prompts"],
  [/\b(jailbreak[- ]?prompts?|prompt[- ]?collection|prompt[- ]?list)\b/i, "prompt dump"],
  [/\b(course|tutorial|cookbook|handbook|cheat[- ]?sheet|roadmap|reading[- ]?list|papers?[- ]?list|interview)\b/i, "learning material"],
  [/\b(homework|assignment|bootcamp|workshop|study[- ]?notes)\b/i, "coursework"],
];

export const notAToolReason = (text: string): string | undefined => NOT_A_TOOL.find(([re]) => re.test(text))?.[1];

export const githubHeaders: Record<string, string> = {
  "User-Agent": "TheInjectionSweep/1.0",
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

export const PACE_MS = process.env.GITHUB_TOKEN ? 2_100 : 6_500;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SearchRepo {
  full_name: string;
  html_url: string;
  stargazers_count: number;
  created_at: string;
  pushed_at?: string;
  description: string | null;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  is_template?: boolean;
  license?: { spdx_id?: string } | null;
  owner: { type: string; login?: string };
}

export async function searchRepos(q: string, perPage = 30): Promise<SearchRepo[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}`;
  const res = await fetch(url, { headers: githubHeaders, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { items: SearchRepo[] }).items;
}

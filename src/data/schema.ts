/**
 * Content schema for The Injection, a feed of AI security news and research.
 *
 * The update agent writes JSON that conforms to `Feed` into
 * `src/data/items.json`. The site renders it; it never edits it.
 */

export type Category =
  | "research" //       a paper, a lab write-up, a new finding
  | "vulnerability" //  a disclosed flaw in a named product, CVE or not
  | "attack" //         a new attack or jailbreak technique
  | "supply-chain" //   skills, MCP servers, plugins, packages, models
  | "incident" //       something that happened in the wild
  | "tool" //           a defensive or offensive tool, scanner, framework
  | "benchmark" //      an eval, leaderboard or measured result
  | "lab-safety" //     a lab or vendor making a specific security claim
  | "talk"; //          a conference talk or video by a strong security voice

export const CATEGORY_ORDER: Category[] = [
  "vulnerability",
  "attack",
  "supply-chain",
  "research",
  "incident",
  "tool",
  "benchmark",
  "lab-safety",
  "talk",
];

/** How much a security reader should care. Not hype, impact. */
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

/** The plain-English part. Every item has one. */
export interface Explainer {
  /** One sentence. Max ~140 chars. */
  tagline: string;
  /** What happened, plainly. 2-3 sentences. */
  whatHappened: string;
  /** How the attack, flaw or tool actually works. 2-4 sentences. */
  howItWorks: string;
  /** Who and what is exposed. 1-3 sentences. */
  whoIsAffected: string;
  /** What a defender should do now, if anything. 1-3 sentences. */
  whatToDo?: string;
}

/** Who did the work. Credit is not optional on a security site. */
export interface Credit {
  name: string;
  /** Org or team, e.g. "AIR Research", "Zenity Labs". */
  org?: string;
  url?: string;
}

export interface QuickFact {
  label: string;
  value: string;
}

export interface Faq {
  /** A literal follow-up query a reader would type. */
  q: string;
  /** A self-contained 40-75 word answer that names the entity. */
  a: string;
}

export interface Link {
  label: string;
  url: string;
}

/** The source's own preview image. Must be fetched and return image/* in the run that adds it. */
export interface ItemImage {
  url: string;
  alt: string;
  /** Where it came from, e.g. "AIR Security". */
  credit?: string;
}

/** One row in a benchmark chart: a model, agent, product or defense. */
export interface BenchmarkResult {
  name: string;
  score: number;
  /** The row this story is about. At most one per benchmark. */
  highlight?: boolean;
}

/**
 * A measured result the source itself publishes: attack success rates,
 * eval scores, detection rates. Renders as comparison bars. Optional and
 * source-gated: `source` must be the item `url` or one of its `links`.
 * Never estimated, never computed from other numbers.
 */
export interface Benchmark {
  /** What was measured, e.g. "Attack success rate, AgentDojo". */
  name: string;
  /** Suffix for scores, default "%". */
  unit?: string;
  /** Top of the scale, default 100. Every score must be <= max. */
  max?: number;
  /** One short line on how to read it, e.g. "Higher is worse for defenders". */
  note?: string;
  /** 2 to 12 rows, in the source's order. */
  results: BenchmarkResult[];
  source: string;
}

/** A talk or video. Required on `talk` items, optional elsewhere. */
export interface Video {
  /** The 11-character YouTube id. */
  youtubeId: string;
  /** Channel name as YouTube shows it, e.g. "DEFCONConference". */
  channel: string;
  /** https://www.youtube.com/@handle or /channel/UC... */
  channelUrl: string;
  /** Conference or series, e.g. "DEF CON 34", when the source names it. */
  event?: string;
}

export interface Item {
  /** kebab-case, stable, unique. Becomes the URL: /items/<id>/ */
  id: string;
  /** First entry is the primary category. */
  categories: Category[];
  /** <= 80 chars. "Name: descriptor". */
  title: string;
  /** Who published it. */
  org: string;
  /** Original public date, YYYY-MM-DD. */
  date: string;
  /** When the agent added it, ISO. Drives sort order. */
  publishDate: string;
  /** Primary source. */
  url: string;
  /** <= 240 chars, answer first. */
  summary: string;
  severity: Severity;
  tags: string[];
  /** Products, models or ecosystems affected, e.g. ["Claude Code", "MCP"]. */
  affected?: string[];
  cve?: string;
  cvss?: number;
  credits: Credit[];
  explainer: Explainer;
  quickFacts?: QuickFact[];
  faq?: Faq[];
  /** At least 2. The first is usually `url`. */
  links: Link[];
  /** Optional. Without one, the site generates a cover from the item. */
  image?: ItemImage;
  /** Optional. Only numbers the source prints, with the source linked. */
  benchmarks?: Benchmark[];
  /** Optional. Required when `categories` includes "talk". */
  video?: Video;
}

export interface Feed {
  generatedAt: string;
  promptVersion: string;
  items: Item[];
}

/** What a tool in the directory is for. Pick by its main job. */
export type ToolKind = "scanner" | "guardrail" | "red-team" | "eval" | "sandbox";

export const TOOL_KIND_ORDER: ToolKind[] = ["scanner", "guardrail", "red-team", "eval", "sandbox"];

/**
 * One open-source AI security tool in the evergreen directory (/tools/).
 * Kept by prompts/maintain-tools.md. Every field comes from the repo's own
 * README, LICENSE or the GitHub API, fetched in the run that wrote it.
 * Stars are not stored: they go stale within days.
 */
export interface ToolEntry {
  /** kebab-case, unique. */
  slug: string;
  name: string;
  /** "owner/repo" on GitHub. Unique. */
  repo: string;
  kind: ToolKind;
  /** <= 200 chars, plain, from the README. What it does, not how good it is. */
  description: string;
  /** SPDX id(s) from the LICENSE file, e.g. "Apache-2.0". */
  license: string;
  /** Who maintains it, as the README or the owner's profile names them. */
  maintainer: string;
  /** Products, protocols or artifacts it covers, e.g. ["MCP servers", "Claude Code"]. */
  covers: string[];
  /** Docs or homepage, when the README links one. */
  homepage?: string;
  /** Feed items about this tool, by id. */
  relatedItems?: string[];
  /** YYYY-MM-DD the entry was added. */
  added: string;
  /** YYYY-MM-DD the entry was last checked against the repo. */
  checked: string;
}

export interface ToolRegistry {
  generatedAt: string;
  tools: ToolEntry[];
}

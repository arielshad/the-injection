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
  | "lab-safety"; //    a lab or vendor making a specific security claim

export const CATEGORY_ORDER: Category[] = [
  "vulnerability",
  "attack",
  "supply-chain",
  "research",
  "incident",
  "tool",
  "benchmark",
  "lab-safety",
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
}

export interface Feed {
  generatedAt: string;
  promptVersion: string;
  items: Item[];
}

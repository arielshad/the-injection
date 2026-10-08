import type { Category, Severity } from "./schema";

/**
 * Category and severity metadata: the single source of truth for badges,
 * filter chips and tooltips.
 *
 * To add a category:
 *   1. Add it to `Category` and `CATEGORY_ORDER` in src/data/schema.ts.
 *   2. Add an entry below (TypeScript fails until you do).
 *   3. Add it to the category list in prompts/update-feed.md.
 */

export interface CategoryMeta {
  id: Category;
  /** Shown on the badge. */
  label: string;
  /** 1 to 3 character glyph for tight spaces. Plain text, no emoji. */
  short: string;
  /** One line, shown in filter tooltips and section headers. */
  blurb: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  vulnerability: {
    id: "vulnerability",
    label: "Vulnerability",
    short: "VLN",
    blurb: "A disclosed flaw in a named AI product, with or without a CVE",
  },
  attack: {
    id: "attack",
    label: "Attack",
    short: "ATK",
    blurb: "New prompt injection, jailbreak or agent attack techniques",
  },
  "supply-chain": {
    id: "supply-chain",
    label: "Supply chain",
    short: "SUP",
    blurb: "Skills, MCP servers, plugins, packages and models that ship risk",
  },
  research: {
    id: "research",
    label: "Research",
    short: "RES",
    blurb: "Papers, lab write-ups and new findings",
  },
  incident: {
    id: "incident",
    label: "Incident",
    short: "INC",
    blurb: "Things that happened in the wild, not in a lab",
  },
  tool: {
    id: "tool",
    label: "Tool",
    short: "TL",
    blurb: "Scanners, guardrails, red-team kits and frameworks",
  },
  benchmark: {
    id: "benchmark",
    label: "Benchmark",
    short: "BM",
    blurb: "Evals, leaderboards and measured results",
  },
  "lab-safety": {
    id: "lab-safety",
    label: "Lab safety",
    short: "LAB",
    blurb: "A lab or vendor making a specific, checkable security claim",
  },
  talk: {
    id: "talk",
    label: "Talk",
    short: "TLK",
    blurb: "Conference talks and videos that spread, or come from a strong security voice",
  },
};

export interface SeverityMeta {
  id: Severity;
  label: string;
  /** What this level means for a defender. Mirrors the rubric in prompts/update-feed.md. */
  blurb: string;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: {
    id: "critical",
    label: "Critical",
    blurb: "Exploited in the wild, or easy remote code execution or data theft in a widely used product with no fix. Act today.",
  },
  high: {
    id: "high",
    label: "High",
    blurb: "A working attack on a widely used AI product or ecosystem. A fix may exist. Patch or mitigate this week.",
  },
  medium: {
    id: "medium",
    label: "Medium",
    blurb: "Real and reproducible, but needs unusual setup, user help or a narrow audience. Plan a fix.",
  },
  low: {
    id: "low",
    label: "Low",
    blurb: "Minor, hard to exploit or mostly theoretical. Good to know.",
  },
  info: {
    id: "info",
    label: "Info",
    blurb: "Research, tools, evals or lab claims with no direct exposure. Context, not an alert.",
  },
};

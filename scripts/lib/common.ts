/**
 * Shared helpers for the sweep pipeline scripts. Pure functions plus a few
 * file-path constants. No network.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORY_ORDER,
  SEVERITY_ORDER,
  type Category,
  type Item,
  type Severity,
} from "../../src/data/schema.ts";
import { TAG_ALIASES, TOPIC_TAGS, isTopicTag } from "../../src/data/tags.ts";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const ITEMS_PATH = resolve(ROOT, "src/data/items.json");
export const SWEEPS_PATH = resolve(ROOT, "src/data/sweeps.json");
export const PROMPT_PATH = resolve(ROOT, "prompts/update-feed.md");
export const DEFAULT_DRAFT = resolve(ROOT, "sweep-draft.json");

/** Default freshness window. Security news moves slower than model releases. */
export const DEFAULT_WINDOW_DAYS = 7;

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
export const writeJson = (path: string, data: unknown): void =>
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");

/** Lowercase, alphanumeric only. "anthropic-claude-code" == "anthropicclaudecode". */
export const normId = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Lowercase host without www, no trailing slash, no fragment, query kept. */
export function canonUrl(u: string): string {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${host}${path}${url.search}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

/** Reads `prompt-version:` from the prompt's frontmatter. */
export function promptVersion(): string {
  try {
    const m = readFileSync(PROMPT_PATH, "utf8").match(/^prompt-version:\s*(\S+)/m);
    return m?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

export const BANNED_WORDS = [
  "revolutionary",
  "groundbreaking",
  "game-changing",
  "game changer",
  "unprecedented",
  "next-generation",
  "cutting-edge",
  "bombshell",
  "terrifying",
  "nightmare",
  "apocalypse",
  "doomsday",
  "massive",
  "shocking",
  "chilling",
  "devastating",
  "skyrocket",
  "unleash",
];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const CVE = /^CVE-\d{4}-\d{4,}$/;
const EM_DASH = new RegExp(String.fromCharCode(0x2014));
const EMOJI = /\p{Extended_Pictographic}/u;

export interface Issues {
  errors: string[];
  warnings: string[];
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isHttps = (v: unknown): boolean => {
  if (!isStr(v)) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** Every string value in an object, with its path. */
function strings(v: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof v === "string") out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) strings(x, path ? `${path}.${k}` : k, out);
  return out;
}

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Image URLs that are almost always a site-wide logo or a default social card,
 * not an editorial image for one story. A match is a warning, not an error:
 * og-image.ts flags it and the prompt tells the agent to omit `image` instead.
 * (opengraph.githubassets.com repo cards are acceptable only if nothing better.)
 */
export const GENERIC_IMAGE_PATTERNS: [RegExp, string][] = [
  [/arxiv\.org\/.*(logo|arxiv-logo|social)/i, "arXiv logo/default card"],
  [/static\.arxiv\.org\//i, "arXiv static asset"],
  [/github\.com\/fluidicon|github\.githubassets\.com\/(images|assets)\//i, "GitHub generic brand image"],
  [/githubassets\.com\/.*advisor/i, "GitHub advisory-database default card"],
  [/opengraph\.githubassets\.com\//i, "GitHub auto-generated repo card (OK only if nothing better)"],
  [/avatars\.githubusercontent\.com\//i, "GitHub avatar"],
  [/nist\.gov\/.*(logo|nist-logo|social|default)/i, "NIST mark/default card"],
  [/nvd\.nist\.gov\//i, "NVD site asset"],
  [/(^|[\/_.-])(logo|favicon|apple-touch-icon|site-icon|default[-_]?(og|share|social)|og[-_]?default|share[-_]?default)([\/_.-]|$)/i, "looks like a logo/favicon/default card"],
  [/\.(ico|svg)(\?|$)/i, "icon or SVG, not a raster cover"],
];

export function genericImageHint(url: string): string | undefined {
  for (const [re, why] of GENERIC_IMAGE_PATTERNS) if (re.test(url)) return why;
  return undefined;
}

/**
 * Schema and house-style validation for one item.
 * mode "draft": publishDate must be absent (finalize stamps it).
 * mode "feed":  publishDate must be a valid ISO timestamp.
 */
export function validateItem(raw: unknown, mode: "draft" | "feed"): Issues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const it = (raw ?? {}) as Partial<Item> & Record<string, unknown>;
  const id = isStr(it.id) ? it.id : "(missing id)";
  const e = (m: string) => errors.push(`${id}: ${m}`);
  const w = (m: string) => warnings.push(`${id}: ${m}`);

  // id
  if (!isStr(it.id)) e("id is required");
  else if (!KEBAB.test(it.id)) e(`id must be kebab-case (got "${it.id}")`);
  else if (it.id.length > 80) e("id longer than 80 chars");

  // categories
  if (!Array.isArray(it.categories) || it.categories.length === 0) e("categories must be a non-empty array");
  else {
    for (const c of it.categories)
      if (!CATEGORY_ORDER.includes(c as Category)) e(`unknown category "${c}" (allowed: ${CATEGORY_ORDER.join(", ")})`);
    if (new Set(it.categories).size !== it.categories.length) e("categories has duplicates");
  }

  // title, org, summary
  if (!isStr(it.title)) e("title is required");
  else if (it.title.length > 80) e(`title is ${it.title.length} chars (max 80)`);
  if (!isStr(it.org)) e("org is required");
  if (!isStr(it.summary)) e("summary is required");
  else if (it.summary.length > 240) e(`summary is ${it.summary.length} chars (max 240)`);

  // dates
  if (!isStr(it.date) || !YMD.test(it.date) || Number.isNaN(Date.parse(`${it.date}T00:00:00Z`)))
    e(`date must be YYYY-MM-DD (got ${JSON.stringify(it.date)})`);
  else if (Date.parse(`${it.date}T00:00:00Z`) > Date.now() + 36 * 3600_000) e(`date ${it.date} is in the future`);
  if (mode === "draft" && it.publishDate !== undefined)
    e("publishDate must NOT be set in a draft (finalize-sweep stamps it)");
  if (mode === "feed" && (!isStr(it.publishDate) || Number.isNaN(Date.parse(it.publishDate))))
    e(`publishDate must be an ISO timestamp (got ${JSON.stringify(it.publishDate)})`);

  // url
  if (!isHttps(it.url)) e(`url must be an https URL (got ${JSON.stringify(it.url)})`);

  // severity
  if (!SEVERITY_ORDER.includes(it.severity as Severity))
    e(`severity must be one of ${SEVERITY_ORDER.join(", ")} (got ${JSON.stringify(it.severity)})`);

  // tags
  if (!Array.isArray(it.tags) || it.tags.length === 0) e("tags must be a non-empty array");
  else {
    for (const t of it.tags) {
      if (typeof t !== "string" || !KEBAB.test(t)) e(`tag "${t}" must be lowercase kebab-case`);
      else if (mode === "draft" && TAG_ALIASES[t]) w(`tag "${t}" is a synonym: use "${TAG_ALIASES[t]}"`);
    }
    if (new Set(it.tags).size !== it.tags.length) e("tags has duplicates");
    if (!it.tags.some((t) => typeof t === "string" && isTopicTag(t)))
      e(`tags need at least one topic tag from src/data/tags.ts (${TOPIC_TAGS.slice(0, 6).join(", ")}, ...)`);
  }

  // affected
  if (it.affected !== undefined && (!Array.isArray(it.affected) || !it.affected.every(isStr)))
    e("affected must be an array of non-empty strings");

  // cve / cvss
  if (it.cve !== undefined && (!isStr(it.cve) || !CVE.test(it.cve))) e(`cve must look like CVE-YYYY-NNNN (got "${it.cve}")`);
  if (it.cvss !== undefined && (typeof it.cvss !== "number" || it.cvss < 0 || it.cvss > 10))
    e(`cvss must be a number 0-10 (got ${JSON.stringify(it.cvss)})`);

  // credits
  if (!Array.isArray(it.credits) || it.credits.length === 0)
    e("credits must name at least one researcher or team (credit is not optional)");
  else
    it.credits.forEach((c, i) => {
      if (!isStr(c?.name)) e(`credits[${i}].name is required`);
      if (c?.url !== undefined && !isHttps(c.url)) e(`credits[${i}].url must be https`);
    });

  // explainer
  const ex = it.explainer;
  if (!ex || typeof ex !== "object") e("explainer is required");
  else {
    for (const k of ["tagline", "whatHappened", "howItWorks", "whoIsAffected"] as const)
      if (!isStr(ex[k])) e(`explainer.${k} is required`);
    if (ex.whatToDo !== undefined && !isStr(ex.whatToDo)) e("explainer.whatToDo must be non-empty when present");
    if (isStr(ex.tagline) && ex.tagline.length > 160) e(`explainer.tagline is ${ex.tagline.length} chars (aim 140, max 160)`);
  }

  // quickFacts / faq
  if (it.quickFacts !== undefined) {
    if (!Array.isArray(it.quickFacts) || it.quickFacts.length === 0) e("quickFacts must be non-empty when present");
    else it.quickFacts.forEach((f, i) => {
      if (!isStr(f?.label) || !isStr(f?.value)) e(`quickFacts[${i}] needs label and value`);
    });
  }
  if (it.faq !== undefined) {
    if (!Array.isArray(it.faq) || it.faq.length === 0) e("faq must be non-empty when present");
    else it.faq.forEach((f, i) => {
      if (!isStr(f?.q) || !isStr(f?.a)) e(`faq[${i}] needs q and a`);
      else {
        const n = wordCount(f.a);
        if (n < 30 || n > 90) w(`faq[${i}].a is ${n} words (target 40-75)`);
      }
    });
  }
  if ((it.severity === "critical" || it.severity === "high") && (!it.quickFacts?.length || !it.faq?.length))
    w(`${it.severity} item is missing quickFacts and/or faq (required at this tier)`);

  // links
  if (!Array.isArray(it.links) || it.links.length < 2) e("links needs at least 2 entries");
  else {
    it.links.forEach((l, i) => {
      if (!isStr(l?.label)) e(`links[${i}].label is required`);
      if (!isHttps(l?.url)) e(`links[${i}].url must be https`);
    });
    const urls = it.links.map((l) => canonUrl(l?.url ?? ""));
    if (new Set(urls).size !== urls.length) e("links has duplicate URLs");
  }

  // image (optional; without one the site generates a cover)
  if (it.image !== undefined) {
    const img = it.image as Partial<NonNullable<Item["image"]>> | null;
    if (!img || typeof img !== "object" || Array.isArray(img)) e("image must be an object { url, alt, credit? } when present");
    else {
      if (!isHttps(img.url)) e(`image.url must be an https URL (got ${JSON.stringify(img.url)})`);
      else {
        const hint = genericImageHint(img.url!);
        if (hint) w(`image.url may not be an editorial image (${hint}): omit image if nothing better`);
      }
      if (!isStr(img.alt)) e("image.alt is required and must be non-empty");
      else if (img.alt.length > 200) w(`image.alt is ${img.alt.length} chars (keep it short)`);
      if (img.credit !== undefined && !isStr(img.credit)) e("image.credit must be non-empty when present");
      for (const k of Object.keys(img)) if (!["url", "alt", "credit"].includes(k)) e(`image has unknown field "${k}"`);
    }
  }

  // video (required on talk items)
  if (Array.isArray(it.categories) && it.categories.includes("talk") && it.video === undefined)
    e('talk items need a video { youtubeId, channel, channelUrl }');
  if (it.video !== undefined) {
    const v = it.video as Partial<NonNullable<Item["video"]>> | null;
    if (!v || typeof v !== "object") e("video must be an object { youtubeId, channel, channelUrl, event? }");
    else {
      if (!isStr(v.youtubeId) || !/^[A-Za-z0-9_-]{11}$/.test(v.youtubeId)) e(`video.youtubeId must be an 11-character YouTube id (got ${JSON.stringify(v.youtubeId)})`);
      if (!isStr(v.channel)) e("video.channel is required");
      if (!isHttps(v.channelUrl) || !/^https:\/\/(www\.)?youtube\.com\//.test(v.channelUrl!)) e("video.channelUrl must be an https youtube.com URL");
      if (v.event !== undefined && !isStr(v.event)) e("video.event must be non-empty when present");
      for (const k of Object.keys(v)) if (!["youtubeId", "channel", "channelUrl", "event"].includes(k)) e(`video has unknown field "${k}"`);
      const watch = isStr(v.youtubeId) ? `https://www.youtube.com/watch?v=${v.youtubeId}` : "";
      const cited = [it.url, ...(Array.isArray(it.links) ? it.links.map((l) => l?.url) : [])].filter(isStr);
      if (watch && !cited.some((u) => u.includes(v.youtubeId!))) e(`video ${watch} must be the item url or one of its links`);
    }
  }

  // benchmarks (optional; every chart must point at a cited source)
  if (it.benchmarks !== undefined) {
    const cited = new Set([it.url, ...(Array.isArray(it.links) ? it.links.map((l) => l?.url) : [])].filter(isStr).map(canonUrl));
    if (!Array.isArray(it.benchmarks) || it.benchmarks.length === 0) e("benchmarks must be a non-empty array when present");
    else
      it.benchmarks.forEach((b, i) => {
        const at = `benchmarks[${i}]`;
        if (!isStr(b?.name)) e(`${at}.name is required`);
        if (b?.unit !== undefined && (typeof b.unit !== "string" || b.unit.length > 12)) e(`${at}.unit must be a short string`);
        const max = b?.max ?? 100;
        if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) e(`${at}.max must be a positive number`);
        if (b?.note !== undefined && !isStr(b.note)) e(`${at}.note must be non-empty when present`);
        if (!isStr(b?.source) || !cited.has(canonUrl(b.source)))
          e(`${at}.source must be the item url or one of its links (every bar must be traceable)`);
        if (!Array.isArray(b?.results) || b.results.length < 2 || b.results.length > 12)
          e(`${at}.results needs 2 to 12 rows`);
        else {
          b.results.forEach((r, j) => {
            if (!isStr(r?.name)) e(`${at}.results[${j}].name is required`);
            if (typeof r?.score !== "number" || !Number.isFinite(r.score) || r.score < 0)
              e(`${at}.results[${j}].score must be a number >= 0`);
            else if (typeof max === "number" && r.score > max) e(`${at}.results[${j}].score ${r.score} is above max ${max}`);
          });
          if (b.results.filter((r) => r?.highlight).length > 1) e(`${at} has more than one highlighted row`);
        }
      });
  }

  // house style
  for (const [path, s] of strings(it, "")) {
    if (EM_DASH.test(s)) e(`em dash in ${path} (house style: use ':' or ',')`);
    if (path.startsWith("url") || path.includes(".url") || path === "id") continue;
    if (EMOJI.test(s)) w(`emoji in ${path}`);
    if (/!(\s|$)/.test(s)) w(`exclamation mark in ${path}`);
    const lower = s.toLowerCase();
    for (const b of BANNED_WORDS) if (new RegExp(`\\b${b}\\b`).test(lower)) w(`banned word "${b}" in ${path}`);
  }

  return { errors, warnings };
}

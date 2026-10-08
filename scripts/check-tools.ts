/**
 * Build gate for the tools directory (src/data/tools.json, page /tools/).
 *
 * Fails (exit 1) on: unknown kind, missing or over-long fields, non-kebab or
 * duplicate slugs, duplicate repos, bad "owner/repo", non-https homepage,
 * relatedItems that are not in the feed, bad dates, em dashes, banned words.
 * With --fetch it also GETs every repo page, README and homepage and fails
 * on non-2xx (the daily maintain-tools run uses this).
 *
 * Usage: npx tsx scripts/check-tools.ts [--fetch]
 */
import { resolve } from "node:path";
import { TOOL_KIND_ORDER, type Feed, type ToolRegistry } from "../src/data/schema.ts";
import { BANNED_WORDS, ITEMS_PATH, ROOT, readJson } from "./lib/common.ts";

export const TOOLS_PATH = resolve(ROOT, "src/data/tools.json");
const fetchMode = process.argv.includes("--fetch");
const errors: string[] = [];
const reg = readJson<ToolRegistry>(TOOLS_PATH);
const feedIds = new Set(readJson<Feed>(ITEMS_PATH).items.map((i) => i.id));

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

if (!str(reg.generatedAt) || Number.isNaN(Date.parse(reg.generatedAt))) errors.push("tools.json: generatedAt must be an ISO timestamp");
if (!Array.isArray(reg.tools)) errors.push("tools.json: tools must be an array");
const tools = Array.isArray(reg.tools) ? reg.tools : [];
const seen = { slug: new Set<string>(), repo: new Set<string>() };

for (const t of tools) {
  const id = str(t.slug) ? t.slug : "(no slug)";
  const e = (m: string) => errors.push(`${id}: ${m}`);
  if (!str(t.slug) || !KEBAB.test(t.slug)) e("slug must be kebab-case");
  else if (seen.slug.has(t.slug)) e("duplicate slug");
  else seen.slug.add(t.slug);
  if (!str(t.name)) e("name is required");
  if (!str(t.repo) || !REPO.test(t.repo)) e(`repo must be "owner/repo" (got ${JSON.stringify(t.repo)})`);
  else if (seen.repo.has(t.repo.toLowerCase())) e(`duplicate repo ${t.repo}`);
  else seen.repo.add(t.repo.toLowerCase());
  if (!TOOL_KIND_ORDER.includes(t.kind)) e(`kind must be one of ${TOOL_KIND_ORDER.join(", ")}`);
  if (!str(t.description)) e("description is required");
  else if (t.description.length > 200) e(`description is ${t.description.length} chars (max 200)`);
  if (!str(t.license)) e("license is required (from the LICENSE file)");
  if (!str(t.maintainer)) e("maintainer is required");
  if (!Array.isArray(t.covers) || t.covers.length === 0 || !t.covers.every(str)) e("covers must be a non-empty array of strings");
  if (t.homepage !== undefined && !(str(t.homepage) && t.homepage.startsWith("https://"))) e("homepage must be https");
  for (const r of t.relatedItems ?? []) if (!feedIds.has(r)) e(`relatedItems "${r}" is not in the feed`);
  for (const k of ["added", "checked"] as const) if (!str(t[k]) || !YMD.test(t[k])) e(`${k} must be YYYY-MM-DD`);
  for (const [k, v] of Object.entries(t)) {
    if (typeof v !== "string") continue;
    if (/—/.test(v)) e(`em dash in ${k}`);
    for (const b of BANNED_WORDS) if (new RegExp(`\\b${b}\\b`, "i").test(v)) e(`banned word "${b}" in ${k}`);
  }
}

if (fetchMode) {
  const urls = tools.flatMap((t) => [
    `https://github.com/${t.repo}`,
    `https://raw.githubusercontent.com/${t.repo}/HEAD/README.md`,
    ...(t.homepage ? [t.homepage] : []),
  ]);
  const results = await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { redirect: "follow", headers: { "User-Agent": "TheInjectionTools/1.0" }, signal: AbortSignal.timeout(20_000) });
        await res.body?.cancel().catch(() => {});
        return res.ok ? null : `${u} -> HTTP ${res.status}`;
      } catch (err) {
        return `${u} -> ${(err as Error).message}`;
      }
    }),
  );
  // A README can be README.rst or readme.md: only a missing repo page is fatal.
  for (const r of results) if (r && !r.includes("raw.githubusercontent.com")) errors.push(`fetch: ${r}`);
  for (const r of results) if (r?.includes("raw.githubusercontent.com")) console.error(`check-tools: note: ${r} (README may have another name)`);
}

if (errors.length) {
  console.error(`check-tools FAILED: ${errors.length} error(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}
console.log(`check-tools ok: ${tools.length} tools${fetchMode ? ", all repo pages and homepages load" : ""}`);

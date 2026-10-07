/**
 * Verify a sweep draft before finalizing it.
 *
 * Usage: npx tsx scripts/verify-draft.ts [draft-path]   (default: sweep-draft.json)
 *
 * 1. Schema + house style: every newItems[] entry must pass validateItem()
 *    in "draft" mode (no publishDate, credits present, >= 2 links, enums,
 *    title <= 80, summary <= 240, no em dashes, ...). Hard fail on errors.
 * 2. Liveness: GETs every item url, links[].url and credits[].url with a
 *    20s timeout, global concurrency 8, per-host concurrency 2. Expects a
 *    2xx after redirects. Hard fail on anything else.
 * 3. Updates: every updates[].id must exist in the feed; every URL inside a
 *    patch is probed too.
 * 4. Images: every image.url (new items and patches) must answer 2xx with a
 *    Content-Type of image/*. An HTML page, a 404 or a redirect to a login
 *    page fails. Find the image with `npx tsx scripts/og-image.ts <page-url>`.
 *
 * A URL that answers 403/429 with a bot challenge (Cloudflare and friends)
 * is retried once with a browser user agent. If it still refuses, it FAILS.
 * Do not work around that by deleting the check: swap to a source that can
 * be machine-verified (the advisory, the paper, the repo) or drop the link.
 *
 * Exit 0 with a JSON summary on stdout, or exit 1 with a JSON failure report
 * on stderr.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Feed, Item } from "../src/data/schema.ts";
import { DEFAULT_DRAFT, ITEMS_PATH, readJson, validateItem } from "./lib/common.ts";

const draftPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_DRAFT;
if (!existsSync(draftPath)) {
  console.error(`draft not found: ${draftPath}`);
  process.exit(1);
}

interface Draft {
  newItems?: Item[];
  updates?: { id: string; patch: Partial<Item>; note?: string }[];
  removals?: { id: string; reason: string }[];
}

const draft = readJson<Draft>(draftPath);
const items = draft.newItems ?? [];
const updates = draft.updates ?? [];
const feed = readJson<Feed>(ITEMS_PATH);
const feedIds = new Set(feed.items.map((i) => i.id));

// ---- 1. schema --------------------------------------------------------------
const schemaErrors: string[] = [];
const schemaWarnings: string[] = [];
for (const it of items) {
  const r = validateItem(it, "draft");
  schemaErrors.push(...r.errors);
  schemaWarnings.push(...r.warnings);
}
const draftIds = items.map((i) => i.id);
for (const id of new Set(draftIds.filter((id, i) => draftIds.indexOf(id) !== i)))
  schemaErrors.push(`${id}: appears more than once in newItems`);
for (const u of updates) {
  if (!feedIds.has(u.id)) schemaErrors.push(`updates: id "${u.id}" is not in the feed`);
  if (u.patch && "publishDate" in u.patch) schemaErrors.push(`updates[${u.id}]: patch must not touch publishDate`);
}
for (const r of draft.removals ?? []) {
  if (!feedIds.has(r.id)) schemaErrors.push(`removals: id "${r.id}" is not in the feed`);
  if (!r.reason) schemaErrors.push(`removals[${r.id}]: reason is required`);
}

// ---- 2. liveness -------------------------------------------------------------
interface Probe {
  itemId: string;
  field: string;
  url: string;
  /** Require Content-Type image/* (image.url probes). */
  image?: boolean;
}
const probes: Probe[] = [];
const seen = new Set<string>();
const add = (itemId: string, field: string, url: unknown, image = false) => {
  if (typeof url !== "string" || !url) return;
  const key = `${itemId}|${url}|${image}`;
  if (seen.has(key)) return;
  seen.add(key);
  probes.push({ itemId, field, url, ...(image ? { image } : {}) });
};
for (const it of items) {
  add(it.id, "url", it.url);
  (it.links ?? []).forEach((l, i) => add(it.id, `links[${i}](${l.label})`, l.url));
  (it.credits ?? []).forEach((c, i) => add(it.id, `credits[${i}](${c.name})`, c.url));
  add(it.id, "image.url", it.image?.url, true);
}
for (const u of updates) {
  const p = u.patch ?? {};
  add(u.id, "patch.url", p.url);
  (p.links ?? []).forEach((l, i) => add(u.id, `patch.links[${i}]`, l.url));
  (p.credits ?? []).forEach((c, i) => add(u.id, `patch.credits[${i}]`, c.url));
  add(u.id, "patch.image.url", p.image?.url, true);
}

const BOT_UA = "Mozilla/5.0 (compatible; TheInjectionSweep/1.0; +https://github.com/)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface Result extends Probe {
  ok: boolean;
  status?: number;
  finalUrl?: string;
  contentType?: string;
  error?: string;
}

const PAGE_ACCEPT = "text/html,application/xhtml+xml,application/json,application/pdf,*/*;q=0.8";
const IMAGE_ACCEPT = "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8";

async function get(url: string, ua: string, accept: string): Promise<{ status: number; finalUrl: string; contentType: string }> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": ua,
      Accept: accept,
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20_000),
  });
  await res.body?.cancel().catch(() => {});
  return { status: res.status, finalUrl: res.url, contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() };
}

async function check(p: Probe): Promise<Result> {
  try {
    const accept = p.image ? IMAGE_ACCEPT : PAGE_ACCEPT;
    let r = await get(p.url, BOT_UA, accept);
    if (r.status === 403 || r.status === 429 || r.status === 503 || r.status === 405) {
      r = await get(p.url, BROWSER_UA, accept);
    }
    const base = { ...p, status: r.status, finalUrl: r.finalUrl, ...(p.image ? { contentType: r.contentType } : {}) };
    if (r.status < 200 || r.status >= 300) return { ...base, ok: false };
    if (p.image && !r.contentType.startsWith("image/"))
      return { ...base, ok: false, error: `not an image (content-type "${r.contentType || "none"}")` };
    return { ...base, ok: true };
  } catch (err) {
    return { ...p, ok: false, error: (err as Error).message };
  }
}

async function runAll(): Promise<Result[]> {
  const GLOBAL = 8;
  const PER_HOST = 2;
  const queue = [...probes];
  const hostActive = new Map<string, number>();
  const out: Result[] = [];
  const host = (u: string) => {
    try {
      return new URL(u).host;
    } catch {
      return "invalid";
    }
  };
  return new Promise((done) => {
    let active = 0;
    const pump = () => {
      if (queue.length === 0 && active === 0) return done(out);
      while (active < GLOBAL) {
        const idx = queue.findIndex((p) => (hostActive.get(host(p.url)) ?? 0) < PER_HOST);
        if (idx < 0) break;
        const [p] = queue.splice(idx, 1);
        const h = host(p.url);
        hostActive.set(h, (hostActive.get(h) ?? 0) + 1);
        active++;
        check(p).then((r) => {
          out.push(r);
          active--;
          hostActive.set(h, (hostActive.get(h) ?? 1) - 1);
          pump();
        });
      }
    };
    pump();
  });
}

console.error(`verify-draft: ${items.length} new item(s), ${updates.length} update(s), ${probes.length} URL(s)`);
const t0 = Date.now();
const results = await runAll();
const failures = results.filter((r) => !r.ok);
const redirected = results
  .filter((r) => r.ok && r.finalUrl && r.finalUrl.replace(/\/$/, "") !== r.url.replace(/\/$/, ""))
  .map((r) => ({ itemId: r.itemId, field: r.field, url: r.url, finalUrl: r.finalUrl }));

const summary = {
  draft: draftPath,
  itemsChecked: items.length,
  probesTotal: probes.length,
  probesOk: results.length - failures.length,
  probesFailed: failures.length,
  imagesChecked: probes.filter((p) => p.image).length,
  schemaErrors: schemaErrors.length,
  schemaWarnings: schemaWarnings.length,
  elapsedSeconds: Number(((Date.now() - t0) / 1000).toFixed(1)),
};

if (failures.length > 0 || schemaErrors.length > 0) {
  console.error("verify-draft FAILED");
  console.error(JSON.stringify({ summary, schemaErrors, failures, schemaWarnings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ summary, ok: true, warnings: schemaWarnings, redirected }, null, 2));

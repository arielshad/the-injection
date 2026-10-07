/**
 * og:image / twitter:image finder for one page.
 *
 * Usage: npx tsx scripts/og-image.ts <page-url>
 *
 * Fetches the page head, collects og:image, og:image:secure_url,
 * og:image:url, twitter:image and twitter:image:src (resolved to absolute
 * URLs, HTML entities decoded), then GETs each candidate and records its
 * status and Content-Type. Prints JSON on stdout:
 *
 *   { pageUrl, imageUrl, contentType, source, isImage, genericHint?, width?, height?, candidates[] }
 *
 * `imageUrl` is the first candidate that returned 2xx + image/*.
 * `genericHint` is set when the URL looks like a logo or a default social
 * card (see GENERIC_IMAGE_PATTERNS in lib/common.ts). This script cannot tell
 * whether the image is about THIS story: look at it and apply the image rules
 * in prompts/update-feed.md. A hint means: omit `image` unless nothing better.
 *
 * Exit 0 when a usable image/* candidate was found, 1 otherwise.
 */
import { genericImageHint } from "./lib/common.ts";

const pageUrl = process.argv[2];
if (!pageUrl) {
  console.error("usage: npx tsx scripts/og-image.ts <page-url>");
  process.exit(1);
}

const BOT_UA = "Mozilla/5.0 (compatible; TheInjectionSweep/1.0; +https://github.com/)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchRaw(url: string, ua: string, accept: string): Promise<Response> {
  return fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": ua, Accept: accept, "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
}

/** GET with one browser-UA retry on bot walls, same policy as verify-draft. */
async function fetchWithRetry(url: string, accept: string): Promise<Response> {
  let res = await fetchRaw(url, BOT_UA, accept);
  if ([403, 405, 429, 503].includes(res.status)) {
    await res.body?.cancel().catch(() => {});
    res = await fetchRaw(url, BROWSER_UA, accept);
  }
  return res;
}

/** Reads up to the end of <head> (max ~400 KB). */
async function fetchHead(url: string): Promise<{ html: string; finalUrl: string }> {
  const res = await fetchWithRetry(url, "text/html,application/xhtml+xml,*/*;q=0.8");
  if (!res.ok) throw new Error(`page fetch ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) return { html: await res.text(), finalUrl: res.url };
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < 400_000) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => {});
  return { html, finalUrl: res.url || url };
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/");

/** All <meta> tags as attribute maps (attribute order independent). */
function metaTags(html: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const a of m[0].matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g))
      attrs[a[1].toLowerCase()] = decodeEntities(a[3] ?? a[4] ?? a[5] ?? "").trim();
    out.push(attrs);
  }
  return out;
}

const SOURCES = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];

interface Candidate {
  source: string;
  url: string;
  status?: number;
  contentType?: string;
  isImage: boolean;
  genericHint?: string;
  error?: string;
}

try {
  const { html, finalUrl } = await fetchHead(pageUrl);
  const metas = metaTags(html);
  const key = (m: Record<string, string>) => (m.property ?? m.name ?? "").toLowerCase();
  const metaVal = (k: string) => metas.find((m) => key(m) === k)?.content;

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const src of SOURCES) {
    for (const m of metas.filter((x) => key(x) === src)) {
      if (!m.content) continue;
      let abs: string;
      try {
        abs = new URL(m.content, finalUrl).toString();
      } catch {
        continue;
      }
      if (seen.has(abs)) continue;
      seen.add(abs);
      candidates.push({ source: src, url: abs, isImage: false, genericHint: genericImageHint(abs) });
    }
  }

  if (candidates.length === 0) {
    console.error(JSON.stringify({ pageUrl, finalUrl, error: "no og:image or twitter:image found" }, null, 2));
    process.exit(1);
  }

  for (const c of candidates) {
    try {
      const res = await fetchWithRetry(c.url, "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8");
      await res.body?.cancel().catch(() => {});
      c.status = res.status;
      c.contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      c.isImage = res.ok && c.contentType.startsWith("image/");
    } catch (err) {
      c.error = (err as Error).message;
    }
  }

  const best = candidates.find((c) => c.isImage && !c.genericHint) ?? candidates.find((c) => c.isImage);
  const width = Number(metaVal("og:image:width")) || undefined;
  const height = Number(metaVal("og:image:height")) || undefined;
  const out = {
    pageUrl,
    finalUrl,
    imageUrl: best?.url ?? null,
    contentType: best?.contentType ?? null,
    source: best?.source ?? null,
    isImage: Boolean(best),
    ...(best?.genericHint ? { genericHint: best.genericHint } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ogTitle: metaVal("og:title") ?? null,
    siteName: metaVal("og:site_name") ?? null,
    candidates,
  };
  if (!best) {
    console.error(JSON.stringify({ ...out, error: "no candidate returned 2xx image/*" }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(out, null, 2));
} catch (err) {
  console.error(`og-image failed: ${(err as Error).message}`);
  process.exit(1);
}

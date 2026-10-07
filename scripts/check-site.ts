/**
 * Post-build checks on dist/: the machine-readable surface agents and
 * crawlers depend on. Run by `pnpm build` after `astro build`, so CI fails if
 * any of it regresses. Exits non-zero with a list of failures.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const feed = JSON.parse(readFileSync(new URL("../src/data/items.json", import.meta.url), "utf8")) as { items: { id: string }[] };
const fails: string[] = [];
const check = (ok: unknown, msg: string) => { if (!ok) fails.push(msg); };
const read = (p: string) => readFileSync(join(DIST, p), "utf8");
const textOf = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

// Homepage: one H1, real content in raw HTML, and enough of it relative to markup.
const home = read("index.html");
const homeText = textOf(home);
check((home.match(/<h1[\s>]/g) ?? []).length === 1, "homepage: exactly one <h1>");
check(homeText.length >= 500, `homepage: >= 500 chars of text without JS (got ${homeText.length})`);
const ratio = homeText.length / home.length;
check(ratio >= 0.05, `homepage: text/HTML ratio >= 5% (got ${(ratio * 100).toFixed(1)}%)`);
check(home.includes('rel="alternate" type="text/markdown"'), "homepage: links its Markdown twin");

// Organization JSON-LD: description and a contact point.
const org = jsonLd(home).flatMap((o) => o["@graph"] ?? [o]).find((o) => o["@type"] === "Organization");
check(org?.description, "Organization JSON-LD: description");
check(org?.contactPoint, "Organization JSON-LD: contactPoint");

// Markdown twins for the homepage and every story.
check(existsSync(join(DIST, "index.md")) && read("index.md").startsWith("# "), "index.md: exists and starts with an H1");
for (const { id } of feed.items) {
  const md = join(DIST, "items", `${id}.md`);
  check(existsSync(md) && readFileSync(md, "utf8").startsWith("# "), `items/${id}.md: exists and starts with an H1`);
  check(read(`items/${id}/index.html`).includes(`type="text/markdown" href="`) && read(`items/${id}/index.html`).includes(`/items/${id}.md"`), `items/${id}/: links its Markdown twin`);
  check(existsSync(join(DIST, "covers", `${id}.svg`)), `covers/${id}.svg: exists`);
}

// llms.txt in the llmstxt.org shape, with when-to-use guidance; and the full-text companion.
const llms = read("llms.txt");
check(/^# .+\n\n> .+/.test(llms), "llms.txt: H1 then a summary blockquote");
check(llms.includes("## When to use"), "llms.txt: has a When to use section");
check(llms.includes("## How to use"), "llms.txt: has a How to use section");
check(existsSync(join(DIST, "llms-full.txt")) && read("llms-full.txt").length > 2000, "llms-full.txt: exists with content");

// Contact routes to the public feedback repo.
check(read("contact/index.html").includes("github.com/arielshad/the-injection-feedback/issues/new?template=correction.yml"), "contact: links the correction form");
check(llms.includes("the-injection-feedback"), "llms.txt: links the feedback repo");
check(org?.sameAs?.some((s: string) => s.includes("the-injection-feedback")), "Organization JSON-LD: sameAs the feedback repo");

// Trust pages with real content.
for (const page of ["about", "contact", "privacy", "developers"]) {
  const p = `${page}/index.html`;
  check(existsSync(join(DIST, p)), `${page}: page exists`);
  // ~400 chars of header/footer chrome are on every page, so 900 means 500+ of the page's own.
  if (existsSync(join(DIST, p))) check(textOf(read(p)).length >= 900, `${page}: >= 500 chars of its own content`);
}

// Exposure page: the strips' stories are in the HTML, not only in the island.
check(existsSync(join(DIST, "exposure/index.html")) && read("exposure/index.html").includes("/items/"), "exposure: page exists and links its stories");

// 404 page: exists, not indexed, points agents at the index.
check(existsSync(join(DIST, "404.html")), "404.html: exists");
if (existsSync(join(DIST, "404.html"))) {
  const nf = read("404.html");
  check(nf.includes('content="noindex"'), "404.html: noindex");
  check(nf.includes("llms.txt") && nf.includes("sitemap-index.xml"), "404.html: links llms.txt and the sitemap");
}

// Sitemap with lastmod; robots pointing at it.
const sm = readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f)).map(read).join("");
check(sm.includes("<lastmod>"), "sitemap: has lastmod");
check(read("robots.txt").includes("Sitemap: "), "robots.txt: names the sitemap");

if (fails.length) {
  console.error(`check-site: ${fails.length} failure(s)\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log(`check-site ok: ${feed.items.length} stories, homepage text ratio ${(ratio * 100).toFixed(1)}%`);

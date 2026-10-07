import type { Item } from "@/data/schema";
import { CATEGORY_META, SEVERITY_META } from "@/data/categories";
import { SITE, abs } from "@/site";

/**
 * Markdown versions of the pages, for agents. Each HTML page links its twin
 * with <link rel="alternate" type="text/markdown">, and the edge (when one is
 * in front of the site) serves them for Accept: text/markdown.
 */

const line = (label: string, value?: string | number) => (value === undefined || value === "" ? "" : `- **${label}:** ${value}\n`);

export function itemMarkdown(it: Item): string {
  const credits = it.credits.map((c) => (c.url ? `[${c.name}](${c.url})` : c.name) + (c.org && c.org !== it.org ? ` (${c.org})` : "")).join(", ");
  return [
    `# ${it.title}`,
    "",
    `> ${it.explainer.tagline}`,
    "",
    line("Severity", `${SEVERITY_META[it.severity].label}: ${SEVERITY_META[it.severity].blurb}`) +
      line("Category", it.categories.map((c) => CATEGORY_META[c].label).join(", ")) +
      line("Published by", it.org) +
      line("Disclosed", it.date) +
      line("CVE", it.cve) +
      line("CVSS", it.cvss) +
      line("Affects", it.affected?.join(", ")) +
      line("Research by", credits) +
      line("Primary source", it.url) +
      line("Page", abs(`/items/${it.id}/`)),
    it.summary,
    "",
    "## What happened",
    "",
    it.explainer.whatHappened,
    "",
    "## How it works",
    "",
    it.explainer.howItWorks,
    "",
    "## Who is affected",
    "",
    it.explainer.whoIsAffected,
    "",
    ...(it.explainer.whatToDo ? ["## What to do", "", it.explainer.whatToDo, ""] : []),
    ...(it.quickFacts?.length ? ["## Quick facts", "", ...it.quickFacts.map((f) => `- **${f.label}:** ${f.value}`), ""] : []),
    ...(it.faq?.length ? ["## Questions", "", ...it.faq.flatMap((f) => [`### ${f.q}`, "", f.a, ""])] : []),
    "## Sources",
    "",
    ...it.links.map((l, i) => `${i + 1}. [${l.label}](${l.url})`),
    "",
  ].join("\n");
}

export function indexMarkdown(items: Item[]): string {
  return [
    `# ${SITE.name}: AI security news`,
    "",
    `> ${SITE.description}`,
    "",
    `Updated every hour. Machine-readable: [llms.txt](${abs("/llms.txt")}), [JSON feed](${abs("/feed.json")}), [RSS](${abs("/rss.xml")}). Every story below also has a Markdown version at its URL with \`.md\` (for example ${abs(`/items/${items[0]?.id ?? "example"}.md`)}).`,
    "",
    "## Latest stories",
    "",
    ...items.map((it) => `- **[${it.title}](${abs(`/items/${it.id}/`)})** (${SEVERITY_META[it.severity].label}, ${it.date}, ${it.org}): ${it.summary}`),
    "",
  ].join("\n");
}

export const markdownResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });

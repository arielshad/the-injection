import { allItems } from "@/data/feed";
import { SITE, abs } from "@/site";

/** JSON Feed 1.1, plus the structured fields, for anyone who wants to build on it. */
export function GET() {
  const body = {
    version: "https://jsonfeed.org/version/1.1",
    title: SITE.name,
    home_page_url: abs("/"),
    feed_url: abs("/feed.json"),
    description: SITE.description,
    items: allItems().slice(0, 100).map((it) => ({
      id: it.id,
      url: abs(`/items/${it.id}/`),
      external_url: it.url,
      title: it.title,
      summary: it.summary,
      content_text: [it.explainer.whatHappened, it.explainer.howItWorks, it.explainer.whoIsAffected, it.explainer.whatToDo].filter(Boolean).join("\n\n"),
      date_published: `${it.date}T12:00:00Z`,
      authors: it.credits.map((c) => ({ name: c.name, url: c.url })),
      tags: [it.severity, ...it.categories, ...it.tags],
      _injection: { severity: it.severity, categories: it.categories, affected: it.affected ?? [], cve: it.cve ?? null, cvss: it.cvss ?? null, links: it.links, benchmarks: it.benchmarks ?? [], video: it.video ?? null },
    })),
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/feed+json; charset=utf-8" } });
}

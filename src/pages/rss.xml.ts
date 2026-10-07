import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { allItems } from "@/data/feed";
import { SITE, abs } from "@/site";

export function GET(context: APIContext) {
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: SITE.url,
    trailingSlash: true,
    items: allItems().slice(0, 50).map((it) => ({
      title: it.title,
      link: abs(`/items/${it.id}/`),
      pubDate: new Date(`${it.date}T12:00:00Z`),
      description: it.summary,
      categories: [it.severity, ...it.categories],
      author: it.credits.map((c) => c.name).join(", "),
    })),
  });
}

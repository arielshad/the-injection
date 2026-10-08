import rss from "@astrojs/rss";
import { weeks, digestSentence } from "@/lib/hubs";
import { SEVERITY_META } from "@/data/categories";
import { SITE, abs } from "@/site";
import { feed } from "@/data/feed";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One entry per week: the weekly digest as a feed, for readers who want a
 * digest instead of every story (and for RSS-to-email services).
 */
export function GET() {
  return rss({
    title: `${SITE.name}: weekly AI security digest`,
    description: "One entry a week: every AI security story disclosed that week, most severe first.",
    site: SITE.url,
    trailingSlash: true,
    items: weeks().slice(0, 52).map((w) => ({
      title: `AI security, week ${w.week} ${w.year}: ${w.items[0].title}`,
      link: abs(`/week/${w.key}/`),
      // The week's last day (or the last sweep, while the week is in progress): never a future date.
      pubDate: new Date(Math.min(Date.parse(`${w.end}T23:59:00Z`), Date.parse(feed.generatedAt))),
      description: digestSentence(w.items, `in week ${w.week} of ${w.year}`),
      content: [
        `<p>${esc(digestSentence(w.items, `in week ${w.week} of ${w.year}`))}</p>`,
        "<ul>",
        ...w.items.map((i) => `<li><strong>${SEVERITY_META[i.severity].label}</strong>: <a href="${abs(`/items/${i.id}/`)}">${esc(i.title)}</a>. ${esc(i.summary)}</li>`),
        "</ul>",
      ].join(""),
    })),
  });
}

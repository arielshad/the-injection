/**
 * Every hub page's share card in one list, so the PNG route and the pages
 * agree on paths. A page passes hubImage(slug) to Base; the route renders
 * /og/hub/<slug>.png from the same entry.
 */
import { GLOSSARY, whatIs } from "@/data/glossary";
import { TOPIC_TAGS } from "@/data/tags";
import { SITE } from "@/site";
import { productHubs, topicItems, weeks } from "@/lib/hubs";
import { OG_HEIGHT, OG_WIDTH } from "@/lib/og";

export interface HubCard { slug: string; seed: string; kicker: string; detail?: string; title: string; byline?: string; alt: string }

const stories = (n: number) => `${n} ${n === 1 ? "story" : "stories"}`;
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function hubCards(): HubCard[] {
  const ws = weeks();
  return [
    { slug: "stats", seed: "hub-stats", kicker: "Index", title: "AI Security Index", byline: "Live numbers on AI security stories: severity, products, CVEs and researchers.", alt: `${SITE.name} AI Security Index` },
    { slug: "log", seed: "hub-log", kicker: "Changelog", title: "Sweep log", byline: "Every hourly sweep: what was searched, added, updated and removed.", alt: `${SITE.name} sweep log` },
    { slug: "products", seed: "hub-products", kicker: "Products", detail: `${productHubs().length} products`, title: "AI product security history", byline: "Every tracked vulnerability and attack, grouped by the product it hits.", alt: `AI product security history on ${SITE.name}` },
    { slug: "learn", seed: "hub-learn", kicker: "Glossary", detail: `${TOPIC_TAGS.length} terms`, title: "AI security glossary", byline: "Prompt injection, tool poisoning, sandbox escapes and more, each with real cases.", alt: `${SITE.name} AI security glossary` },
    { slug: "week", seed: "hub-week", kicker: "Weekly", detail: `${ws.length} weeks`, title: "AI security, week by week", byline: "Weekly digests of AI security news, most severe first.", alt: `${SITE.name} weekly digests` },
    ...productHubs().map((h) => ({
      slug: `products/${h.product.slug}`,
      seed: `product-${h.product.slug}`,
      kicker: "Product",
      detail: stories(h.items.length),
      title: `${h.product.name} security history`,
      byline: `${h.product.vendor} · vulnerabilities, attacks and fixes`,
      alt: `${h.product.name} security history: ${stories(h.items.length)} on ${SITE.name}`,
    })),
    ...TOPIC_TAGS.map((t) => ({
      slug: `learn/${t}`,
      seed: `learn-${t}`,
      kicker: "Glossary",
      detail: stories(topicItems(t).length),
      title: whatIs(t),
      byline: "Definition, how it works, how to defend, and real cases",
      alt: `${whatIs(t)} ${GLOSSARY[t].term}: definition and stories on ${SITE.name}`,
    })),
    ...ws.map((w) => ({
      slug: `week/${w.key}`,
      seed: `week-${w.key}`,
      kicker: "Weekly digest",
      detail: `${fmt(w.start)} to ${fmt(w.end)} · ${stories(w.items.length)}`,
      title: `AI security, week ${w.week} of ${w.year}`,
      byline: `Top story: ${w.items[0].title}`,
      alt: `${SITE.name} weekly digest, week ${w.week} of ${w.year}`,
    })),
  ];
}

export function hubImage(slug: string) {
  const c = hubCards().find((x) => x.slug === slug);
  if (!c) throw new Error(`no hub card for ${slug}`);
  return { path: `/og/hub/${slug}.png`, alt: c.alt, width: OG_WIDTH, height: OG_HEIGHT };
}

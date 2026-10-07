import { allItems } from "@/data/feed";
import { CATEGORY_ORDER } from "@/data/schema";
import { CATEGORY_META } from "@/data/categories";
import { SITE, abs } from "@/site";

export function GET() {
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "## Sections",
    ...CATEGORY_ORDER.map((c) => `- [${CATEGORY_META[c].label}](${abs(`/category/${c}/`)}): ${CATEGORY_META[c].blurb}`),
    `- [About and method](${abs("/about/")})`,
    "",
    "## Latest",
    ...allItems().slice(0, 30).map((it) => `- [${it.title}](${abs(`/items/${it.id}/`)}): ${it.summary}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

import { allItems } from "@/data/feed";
import { indexMarkdown, itemMarkdown } from "@/lib/markdown";

/** Every story in full, one Markdown document, for agents that want the whole corpus in one fetch. */
export function GET() {
  const items = allItems();
  const body = [indexMarkdown(items), ...items.map(itemMarkdown)].join("\n---\n\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

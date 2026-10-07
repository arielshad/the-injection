import type { APIRoute } from "astro";
import { allItems } from "@/data/feed";
import { itemMarkdown, markdownResponse } from "@/lib/markdown";

export function getStaticPaths() {
  return allItems().map((item) => ({ params: { id: item.id }, props: { item } }));
}

export const GET: APIRoute = ({ props }) => markdownResponse(itemMarkdown(props.item));

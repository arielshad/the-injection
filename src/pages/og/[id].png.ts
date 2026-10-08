import type { APIRoute } from "astro";
import { allItems } from "@/data/feed";
import { itemCard } from "@/lib/og";

/** The share card for each story: what Slack, X and LinkedIn show when the link is pasted. */
export function getStaticPaths() {
  return allItems().map((item) => ({ params: { id: item.id }, props: { item } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await itemCard(props.item)), { headers: { "Content-Type": "image/png" } });

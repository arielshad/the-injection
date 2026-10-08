import type { APIRoute } from "astro";
import { CATEGORY_ORDER } from "@/data/schema";
import { itemsByCategory } from "@/data/feed";
import { categoryCard } from "@/lib/og";

/** The share card for each category page. */
export function getStaticPaths() {
  return CATEGORY_ORDER.map((cat) => ({ params: { cat }, props: { cat } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await categoryCard(props.cat, itemsByCategory(props.cat).length)), { headers: { "Content-Type": "image/png" } });

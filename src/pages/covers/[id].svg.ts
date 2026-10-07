import type { APIRoute } from "astro";
import { allItems } from "@/data/feed";
import { coverArt } from "@/lib/cover";

/**
 * The generated cover art as a standalone SVG file per story. Pages reference
 * it with <img>, so the pattern markup is cached once instead of inlined into
 * every page (it was a third of the homepage's HTML).
 */
export function getStaticPaths() {
  return allItems().map((item) => ({ params: { id: item.id }, props: { item } }));
}

export const GET: APIRoute = ({ props }) => {
  const art = coverArt(props.item);
  const body = art.svg
    .replace(' aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%"', ' width="400" height="225"')
    .replace(">", `><rect width="400" height="225" fill="${art.bg}"/>`);
  return new Response(body, { headers: { "Content-Type": "image/svg+xml" } });
};

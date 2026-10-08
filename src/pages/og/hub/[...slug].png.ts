import type { APIRoute } from "astro";
import { hubCard } from "@/lib/og";
import { hubCards } from "@/lib/hub-cards";

/** Share cards for hub pages: /og/hub/<page path>.png, one per entry in hubCards(). */
export function getStaticPaths() {
  return hubCards().map((c) => ({ params: { slug: c.slug }, props: { card: c } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await hubCard(props.card)), { headers: { "Content-Type": "image/png" } });

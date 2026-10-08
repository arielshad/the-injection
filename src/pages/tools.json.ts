import { toolRegistry } from "@/data/tools";

/** The tools directory as JSON, same data as /tools/. */
export function GET() {
  return new Response(JSON.stringify(toolRegistry, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

import { abs } from "@/site";

const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot"];

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    ...AI_BOTS.flatMap((b) => [`User-agent: ${b}`, "Allow: /", ""]),
    `Sitemap: ${abs("/sitemap-index.xml")}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

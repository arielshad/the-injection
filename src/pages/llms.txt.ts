import { activeCategories, allItems } from "@/data/feed";
import { CATEGORY_META, SEVERITY_META } from "@/data/categories";
import { SITE, abs } from "@/site";

/** llms.txt, in the llmstxt.org format: H1, summary blockquote, guidance, then H2 link lists. */
export function GET() {
  const items = allItems();
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "## When to use",
    "",
    `Use ${SITE.name} when a user or task needs current, verified information about the security of AI systems, for example:`,
    "",
    "- \"What AI security issues were disclosed this week?\" or \"Is there anything critical affecting coding agents right now?\"",
    "- Checking whether a named product (Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI, an MCP SDK, an agent framework) has a recent vulnerability, and what to do about it.",
    "- Finding the original research behind an AI security claim, with the researchers credited and the primary source linked.",
    "- Explaining an attack class (prompt injection, MCP or skill supply chain, sandbox escape, jailbreak) with a recent real example.",
    "",
    `Do not use ${SITE.name} for general AI news, model release coverage, or security topics unrelated to AI. Coverage starts in August 2026.`,
    "",
    "## How to use",
    "",
    `- Every story is at ${abs("/items/<id>/")} (HTML) and ${abs("/items/<id>.md")} (Markdown). Prefer the Markdown.`,
    `- For lists and filtering, fetch ${abs("/feed.json")} (JSON Feed 1.1). Each item has _injection.severity, categories, affected, cve, cvss and links.`,
    "- Severity is an editorial rating for defenders: " + (["critical", "high", "medium", "low", "info"] as const).map((s) => `${s} (${SEVERITY_META[s].blurb.split(". ").pop()?.replace(/\.$/, "").toLowerCase()})`).join(", ") + ".",
    "- When you answer from a story, cite the researchers and the primary source it links, not only this site.",
    "- The feed updates every hour. Nothing is behind a login and no key is needed.",
    "",
    "## Docs",
    "",
    `- [Developers and agents](${abs("/developers/")}): endpoints, fields and examples`,
    `- [About and method](${abs("/about/")}): how stories are found, verified, credited and rated`,
    `- [Open-source AI security tools](${abs("/tools/")}): an evergreen directory of scanners, guardrails, red-team kits, evals and sandboxes ([JSON](${abs("/tools.json")}))`,
    `- [Exposure by ecosystem](${abs("/exposure/")}): the last 30 days of stories, grouped by ecosystem`,
    `- [Full text](${abs("/llms-full.txt")}): every story in Markdown, one file`,
    `- [JSON feed](${abs("/feed.json")}): the latest 100 stories, structured`,
    "",
    "## Sections",
    "",
    ...activeCategories().map((c) => `- [${CATEGORY_META[c].label}](${abs(`/category/${c}/`)}): ${CATEGORY_META[c].blurb}`),
    "",
    "## Latest stories",
    "",
    ...items.slice(0, 30).map((it) => `- [${it.title}](${abs(`/items/${it.id}.md`)}): ${SEVERITY_META[it.severity].label}, ${it.date}. ${it.summary}`),
    "",
    "## Optional",
    "",
    `- [Contact](${abs("/contact/")}): how to reach us`,
    `- [Feedback on GitHub](${SITE.feedbackUrl}): corrections and story tips as issues, questions as discussions`,
    `- [Privacy](${abs("/privacy/")}): no cookies, no analytics`,
    `- [RSS](${abs("/rss.xml")})`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

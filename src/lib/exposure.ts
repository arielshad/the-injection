import type { Item, Severity } from "@/data/schema";
import type { CompactStrip, StripDay } from "@/components/ExposureStrips";

/** Which ecosystem a story touches, from its tags, products and title. One story can touch several. */
const ECOSYSTEMS: { name: string; match: RegExp }[] = [
  { name: "Coding agents", match: /claude code|codex|copilot|cursor|gemini cli|ollama|coding[- ]agent|windsurf/i },
  { name: "MCP & plugins", match: /\bmcp\b|model context protocol|plugin|skill|extension/i },
  { name: "Packages & models", match: /pypi|npm|package|registry|supply[- ]chain|model weights|hugging ?face/i },
  { name: "Assistants & apps", match: /chatgpt|claude desktop|assistant|agentforce|salesforce|copilot|sql server|browser/i },
  { name: "Labs & evals", match: /aisi|caisi|benchmark|eval|frontier|safeguard|lab/i },
];

const WORST: Record<Severity, StripDay["worst"]> = { critical: "error", high: "error", medium: "degraded", low: "info", info: "info" };
const RANK: StripDay["worst"][] = ["success", "info", "degraded", "error"];

export function exposureStrips(items: Item[], days = 30): { end: string; strips: CompactStrip[] } {
  const end = items.reduce((m, i) => (i.date > m ? i.date : m), "0000-00-00");
  const endMs = Date.parse(`${end}T12:00:00Z`);
  const dayList = Array.from({ length: days }, (_, k) => new Date(endMs - (days - 1 - k) * 86_400_000).toISOString().slice(0, 10));
  // Compact on purpose: this is island props, serialised into the page. One
  // character per day (s/i/d/e), stories only for the days that have any.
  const strips = ECOSYSTEMS.map(({ name, match }) => {
    const hits = items.filter((i) => match.test([i.title, ...i.tags, ...(i.affected ?? []), ...i.categories].join(" ")));
    let worst = "";
    const stories: Record<number, [string, string][]> = {};
    dayList.forEach((day, k) => {
      const today = hits.filter((i) => i.date === day);
      const w = today.reduce<StripDay["worst"]>((acc, i) => (RANK.indexOf(WORST[i.severity]) > RANK.indexOf(acc) ? WORST[i.severity] : acc), "success");
      worst += w[0];
      if (today.length) stories[k] = today.map((i) => [i.id, i.title]);
    });
    return { name, worst, stories };
  });
  return { end, strips };
}

import type { Item, Severity } from "@/data/schema";
import type { Strip, StripDay } from "@/components/ExposureStrips";

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

export function exposureStrips(items: Item[], days = 30): Strip[] {
  const end = items.reduce((m, i) => (i.date > m ? i.date : m), "0000-00-00");
  const endMs = Date.parse(`${end}T12:00:00Z`);
  const dayList = Array.from({ length: days }, (_, k) => new Date(endMs - (days - 1 - k) * 86_400_000).toISOString().slice(0, 10));
  return ECOSYSTEMS.map(({ name, match }) => {
    const hits = items.filter((i) => match.test([i.title, ...i.tags, ...(i.affected ?? []), ...i.categories].join(" ")));
    return {
      name,
      days: dayList.map((day) => {
        const stories = hits.filter((i) => i.date === day);
        const worst = stories.reduce<StripDay["worst"]>((w, i) => (RANK.indexOf(WORST[i.severity]) > RANK.indexOf(w) ? WORST[i.severity] : w), "success");
        return { day, worst, stories: stories.map((i) => ({ id: i.id, title: i.title, severity: i.severity })) };
      }),
    };
  });
}

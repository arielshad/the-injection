import raw from "./tools.json";
import { TOOL_KIND_ORDER, type ToolEntry, type ToolKind, type ToolRegistry } from "./schema";

/** The evergreen directory of open-source AI security tools. Kept by prompts/maintain-tools.md. */
export const toolRegistry = raw as unknown as ToolRegistry;

export const TOOL_KIND_META: Record<ToolKind, { label: string; blurb: string }> = {
  scanner: { label: "Scanners", blurb: "Check MCP servers, skills, agents and model files for malicious or unsafe content before you run them" },
  guardrail: { label: "Guardrails", blurb: "Sit between your app and the model to filter inputs and outputs at runtime" },
  "red-team": { label: "Red teaming", blurb: "Attack your own LLM apps and agents to find prompt injection, jailbreaks and leaks first" },
  eval: { label: "Evals and benchmarks", blurb: "Measure how well agents and defenses hold up against known attacks" },
  sandbox: { label: "Sandboxes", blurb: "Limit what agents and AI-generated code can touch on disk and on the network" },
};

const byName = (a: ToolEntry, b: ToolEntry) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

export const toolsByKind = (): { kind: ToolKind; tools: ToolEntry[] }[] =>
  TOOL_KIND_ORDER.map((kind) => ({ kind, tools: toolRegistry.tools.filter((t) => t.kind === kind).sort(byName) })).filter((g) => g.tools.length > 0);

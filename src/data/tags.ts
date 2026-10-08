/**
 * Canonical topic tags. Every item carries at least one, so tag chips and
 * search connect stories instead of scattering them. Product, vendor and model
 * names (claude-code, github-copilot, openai) stay free-form on top of these.
 *
 * Why: the first 23 items used 107 distinct tags, 82 of them once. ai-tldr
 * fixed the same drift with a fixed hashtag vocabulary for its science lane.
 *
 * Add a tag here only when a real story needs it and no existing tag fits.
 * Keep prompts/update-feed.md (Item fields > tags) in sync: it prints this list.
 */
export const TOPIC_TAGS = [
  // attack techniques
  "prompt-injection",
  "indirect-prompt-injection",
  "jailbreak",
  "guardrail-bypass",
  "tool-poisoning",
  "data-exfiltration",
  "credential-theft",
  "rce",
  "zero-click",
  "sandbox-escape",
  "approval-bypass",
  "privilege-escalation",
  "data-poisoning",
  "model-backdoor",
  "typosquatting",
  "malicious-package",
  "rogue-agents",
  // surfaces
  "coding-agents",
  "browser-agents",
  "mcp",
  "skills",
  "plugins",
  "agent-memory",
  "rag",
  "model-supply-chain",
  "open-weights",
  // defense and measurement
  "agent-security",
  "guardrails",
  "detection",
  "red-team",
  "evals",
  "cyber-capability",
  "threat-intel",
  "ai-enabled-offense",
] as const;

export type TopicTag = (typeof TOPIC_TAGS)[number];

/** Common synonyms and their canonical tag. A draft using one gets a warning. */
export const TAG_ALIASES: Record<string, TopicTag> = {
  "prompt-injections": "prompt-injection",
  "indirect-injection": "indirect-prompt-injection",
  jailbreaks: "jailbreak",
  jailbreaking: "jailbreak",
  "guardrail-evasion": "guardrail-bypass",
  "mcp-tool-poisoning": "tool-poisoning",
  exfiltration: "data-exfiltration",
  "data-leak": "data-exfiltration",
  "secrets-leak": "credential-theft",
  "remote-code-execution": "rce",
  "sandbox-bypass": "sandbox-escape",
  "auto-approve-bypass": "approval-bypass",
  poisoning: "data-poisoning",
  backdoor: "model-backdoor",
  backdoors: "model-backdoor",
  "malicious-packages": "malicious-package",
  "rogue-agent": "rogue-agents",
  "coding-agent": "coding-agents",
  "ai-coding-agents": "coding-agents",
  "model-context-protocol": "mcp",
  "agent-skills": "skills",
  agent: "agent-security",
  "ai-agent-security": "agent-security",
  "red-teaming": "red-team",
  eval: "evals",
  evaluation: "evals",
  "threat-intelligence": "threat-intel",
  "ai-offense": "ai-enabled-offense",
};

const TOPIC_SET: ReadonlySet<string> = new Set(TOPIC_TAGS);
export const isTopicTag = (t: string): t is TopicTag => TOPIC_SET.has(t);

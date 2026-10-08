/**
 * Canonical AI products for the /products/ hubs. Stories are matched by
 * their free-form `affected` entries (regex) and product tags (exact), so
 * "GitHub Copilot CLI" and "GitHub Copilot in SSMS" both land on one page.
 *
 * Add a product when a second story about it lands; a hub page is only
 * built once two stories match (see productHubs in src/lib/hubs.ts).
 * Keep the blurb factual and short: what the product is, not a verdict.
 */
export interface Product {
  slug: string;
  name: string;
  vendor: string;
  /** One line: what it is. */
  blurb: string;
  /** Tested against each `affected` entry. */
  match: RegExp;
  /** Exact tags that also count. */
  tags?: string[];
}

export const PRODUCTS: Product[] = [
  { slug: "claude-code", name: "Claude Code", vendor: "Anthropic", blurb: "Anthropic's agentic coding tool for the terminal, IDEs and GitHub.", match: /^claude code\b/i, tags: ["claude-code"] },
  { slug: "claude", name: "Claude apps", vendor: "Anthropic", blurb: "Anthropic's Claude assistant: the web and desktop apps, Cowork, skills and connectors.", match: /^claude(?! code)\b|claude desktop|claude organization skills/i, tags: ["claude", "claude-desktop"] },
  { slug: "github-copilot", name: "GitHub Copilot", vendor: "GitHub (Microsoft)", blurb: "GitHub's AI coding assistant, in editors, the Copilot CLI and other Microsoft tools.", match: /copilot/i, tags: ["github-copilot"] },
  { slug: "openai-codex", name: "OpenAI Codex", vendor: "OpenAI", blurb: "OpenAI's coding agent: the Codex CLI, IDE extension and cloud agent.", match: /\bcodex\b/i, tags: ["codex"] },
  { slug: "gemini-cli", name: "Gemini CLI", vendor: "Google", blurb: "Google's open-source coding agent for the terminal, built on Gemini models.", match: /gemini cli/i, tags: ["gemini-cli"] },
  { slug: "qwen-code", name: "Qwen Code", vendor: "Alibaba (Qwen)", blurb: "The Qwen team's open-source coding agent for the terminal.", match: /qwen code/i, tags: ["qwen-code"] },
  { slug: "cursor", name: "Cursor", vendor: "Anysphere", blurb: "An AI code editor and its CLI agent.", match: /\bcursor\b/i, tags: ["cursor"] },
  { slug: "chatgpt", name: "ChatGPT", vendor: "OpenAI", blurb: "OpenAI's assistant, including code execution, connectors and agent mode.", match: /chatgpt/i, tags: ["chatgpt"] },
  { slug: "ollama", name: "Ollama", vendor: "Ollama", blurb: "A runtime for running open-weight models locally, with an experimental agent mode.", match: /\bollama\b/i, tags: ["ollama"] },
  { slug: "mcp-sdks", name: "MCP SDKs and registry", vendor: "Model Context Protocol", blurb: "The official Model Context Protocol SDKs, clients and server registry.", match: /modelcontextprotocol|mcp registry|^mcp clients|^mcp$/i },
  { slug: "salesforce-agentforce", name: "Salesforce Agentforce", vendor: "Salesforce", blurb: "Salesforce's platform for AI agents inside its CRM and Slack.", match: /agentforce/i, tags: ["agentforce"] },
  { slug: "langchain", name: "LangChain and Langflow", vendor: "LangChain / Langflow", blurb: "Open-source frameworks and visual builders for LLM apps and agents.", match: /^lang(chain|flow)\b/i, tags: ["langflow", "langchain"] },
  { slug: "litellm", name: "LiteLLM", vendor: "BerriAI", blurb: "An open-source proxy and SDK that puts many model APIs behind one interface.", match: /^litellm\b/i, tags: ["litellm"] },
];

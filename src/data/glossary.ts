/**
 * The AI security glossary behind /learn/. One entry per topic tag in
 * src/data/tags.ts, so every tag chip on a story opens a page that says what
 * the term means and lists every story filed under it.
 *
 * Writing rules: `short` answers "what is X?" on its own in 40 to 60 words
 * and names the term in its first words (it is what search engines and
 * assistants quote). `how` explains the mechanism plainly. `defend` is what a
 * team can actually do. No incident claims here: real examples come from the
 * stories listed under each entry, which are sourced.
 *
 * TypeScript fails the build when a topic tag has no entry.
 */
import type { TopicTag } from "./tags";

export interface GlossaryEntry {
  term: string;
  /** 40-60 words, answer first, self-contained. */
  short: string;
  /** 2-4 sentences on how it works. */
  how: string;
  /** 1-3 sentences on what defenders can do. */
  defend: string;
  /** Related topic tags. */
  see: TopicTag[];
  /** Other names people search for. */
  aka?: string[];
}

export const GLOSSARY: Record<TopicTag, GlossaryEntry> = {
  "prompt-injection": {
    term: "Prompt injection",
    short: "Prompt injection is an attack where text written by an attacker is treated as instructions by a large language model, overriding what the developer or user asked it to do. It works because models read instructions and data in the same stream of text and cannot reliably tell them apart.",
    how: "The attacker places instructions where the model will read them: in the chat itself (direct injection) or in content the model processes, such as a web page, email, file or tool result (indirect injection). If the model follows them, it can leak data, call tools or produce output its operator never intended. The impact grows with what the model is allowed to do.",
    defend: "Treat model output as untrusted, limit the tools and data an agent can reach, require human approval for sensitive actions, and keep secrets out of the context window. Filters and classifiers reduce risk but do not remove it.",
    see: ["indirect-prompt-injection", "jailbreak", "data-exfiltration", "agent-security"],
    aka: ["LLM prompt injection", "prompt hijacking"],
  },
  "indirect-prompt-injection": {
    term: "Indirect prompt injection",
    short: "Indirect prompt injection is prompt injection delivered through content an AI system reads on a user's behalf, such as a web page, document, email, code comment, issue or tool response, rather than typed by the user. The victim never sees the malicious instructions; their own assistant or agent acts on them.",
    how: "An attacker plants instructions in something the target's agent is likely to process: a README, a calendar invite, a support ticket, a search result. When the agent retrieves it, the model reads the planted text as part of its task. Coding agents, browser agents and assistants with connectors are exposed because they read untrusted content and can act.",
    defend: "Assume anything an agent retrieves may contain instructions. Separate reading from acting, show users what an agent is about to do, block automatic rendering of links and images in output, and scope connector permissions tightly.",
    see: ["prompt-injection", "data-exfiltration", "zero-click", "browser-agents"],
    aka: ["indirect injection", "cross-domain prompt injection", "XPIA"],
  },
  jailbreak: {
    term: "Jailbreak",
    short: "A jailbreak is a prompt or technique that gets an AI model to produce content or take actions its safety training is meant to refuse. Unlike prompt injection, which hijacks an application, a jailbreak targets the model's own safeguards, usually by the user themselves.",
    how: "Jailbreaks use role-play, hypothetical framing, encoding tricks, many-shot examples, multi-turn escalation or optimised adversarial strings to steer the model past its refusals. Techniques often transfer between models and get patched, then reappear in new forms.",
    defend: "Do not rely on model refusals as the only control for harmful capabilities. Add input and output classifiers, monitor for abuse patterns, and test models with current jailbreak suites before release.",
    see: ["guardrail-bypass", "prompt-injection", "red-team", "guardrails"],
    aka: ["LLM jailbreak", "jailbreaking"],
  },
  "guardrail-bypass": {
    term: "Guardrail bypass",
    short: "A guardrail bypass is a technique that gets past a safety layer placed around an AI model, such as an input filter, output classifier, prompt-injection detector or policy engine, so that blocked content or actions go through. It targets the wrapper, not the model's own training.",
    how: "Bypasses exploit gaps between what the guardrail checks and what the model understands: encodings, other languages, split payloads, unusual formatting, or content the guardrail never sees, such as tool results. Classifier-based guardrails can also be fooled by adversarial inputs tuned against them.",
    defend: "Layer controls instead of trusting one filter, check both inputs and outputs, and test guardrails with adversarial suites. Enforce hard limits (permissions, sandboxes, approvals) outside the model wherever possible.",
    see: ["guardrails", "jailbreak", "detection", "red-team"],
    aka: ["guardrail evasion", "filter bypass"],
  },
  "tool-poisoning": {
    term: "Tool poisoning",
    short: "Tool poisoning is an attack where the description, schema or output of a tool given to an AI agent, often an MCP server, carries hidden instructions or misleading behaviour. The agent trusts the tool's metadata, so a poisoned tool can steer it into leaking data or calling other tools.",
    how: "Agents read tool names, descriptions and parameter docs to decide what to call. A malicious or compromised server can hide instructions there, change them after a user approves the tool (a rug pull), or impersonate a trusted tool's name. Because the text is rarely shown to users, the manipulation is easy to miss.",
    defend: "Install tools only from sources you trust, pin versions, review tool descriptions, and alert on changes. Give each tool the least access it needs and keep high-risk tools out of agents that also read untrusted content.",
    see: ["mcp", "plugins", "prompt-injection", "malicious-package"],
    aka: ["MCP tool poisoning", "rug pull"],
  },
  "data-exfiltration": {
    term: "Data exfiltration",
    short: "Data exfiltration in AI systems is getting sensitive data out of a model's context, connected tools or environment to an attacker. It is the usual goal of prompt injection: the model is tricked into sending secrets, files or chat history somewhere the attacker can read them.",
    how: "Common channels are links and images rendered in output (data packed into a URL the client fetches), tool calls that send email or make web requests, writing to shared documents, and DNS or HTTP requests from code execution. Any action that reaches the outside world can carry data.",
    defend: "Block automatic loading of external images and links in AI output, restrict network egress from agents and sandboxes, require approval for outbound actions, and keep secrets out of the model's reach.",
    see: ["prompt-injection", "indirect-prompt-injection", "credential-theft", "zero-click"],
    aka: ["exfiltration", "data leak"],
  },
  "credential-theft": {
    term: "Credential theft",
    short: "Credential theft in AI security means stealing API keys, OAuth tokens, cloud credentials or passwords through AI tools, agents or their supply chain. Agents often run with a developer's full access, so a hijacked agent or malicious plugin can read and send secrets it was never meant to touch.",
    how: "Secrets leak through environment variables and config files an agent can read, tokens passed to the wrong server, malicious packages that harvest keys on install, and prompt injection that asks an agent to print or send them. Leaked AI provider keys are also abused for free model access.",
    defend: "Give agents scoped, short-lived credentials instead of personal tokens, keep secrets out of working directories, use secret scanning, and rotate anything an untrusted tool could have read.",
    see: ["data-exfiltration", "malicious-package", "coding-agents", "privilege-escalation"],
    aka: ["secrets leak", "token theft"],
  },
  rce: {
    term: "Remote code execution (RCE)",
    short: "Remote code execution (RCE) is a flaw that lets an attacker run their own code or commands on a machine they do not control. In AI products it often comes from agents that run shell commands, plugins that execute on install, or model output that is evaluated as code.",
    how: "In agentic tools the path is frequently: untrusted content reaches the model, the model emits a command or file, and the tool runs it without a strong enough check. Classic bugs also apply: unsafe deserialisation of model files, template injection and command injection in AI frameworks and servers.",
    defend: "Run agents and model-serving code in sandboxes with no standing credentials, require approval for commands, avoid loading untrusted model formats that execute code, and patch AI frameworks as quickly as any other server software.",
    see: ["sandbox-escape", "approval-bypass", "zero-click", "coding-agents"],
    aka: ["remote code execution", "command execution"],
  },
  "zero-click": {
    term: "Zero-click attack",
    short: "A zero-click attack compromises a target without them doing anything beyond normal use: no link to click, no file to open, no prompt to approve. In AI systems, an agent that reads incoming email, tickets or repos on its own can be hijacked the moment malicious content arrives.",
    how: "The attacker sends content to a channel an AI agent processes automatically. The agent reads it, follows the embedded instructions and acts, for example by searching for secrets and sending them out, before any human looks. Automation is what turns injection into zero-click.",
    defend: "Be careful about which inbound channels agents process unattended, require approval before agents act on untrusted input, and limit what autonomous agents can reach and send.",
    see: ["indirect-prompt-injection", "rce", "data-exfiltration", "agent-security"],
    aka: ["zero-interaction"],
  },
  "sandbox-escape": {
    term: "Sandbox escape",
    short: "A sandbox escape is a flaw that lets code or an AI agent break out of the isolated environment meant to contain it and reach the host, other tenants or the network. For coding agents and code-execution features, the sandbox is often the main barrier between a hijacked model and real damage.",
    how: "Escapes come from symlinks and path tricks that write outside the allowed directory, race conditions between a check and a use, permitted commands that can run other commands, misconfigured containers and overly broad network rules.",
    defend: "Use OS-level isolation (containers, VMs) rather than only allow-lists, deny network egress by default, test path handling and symlinks, and keep secrets out of anything the sandbox can mount.",
    see: ["rce", "approval-bypass", "privilege-escalation", "coding-agents"],
    aka: ["sandbox bypass", "container escape"],
  },
  "approval-bypass": {
    term: "Approval bypass",
    short: "An approval bypass is a flaw that lets an AI agent run a command, edit a file or call a tool that should have required the user's confirmation. Human-in-the-loop prompts are a key control for coding agents, so getting around them turns prompt injection into direct execution.",
    how: "Typical causes are allow-lists that check only the first command in a chain, shell features (pipes, substitutions, environment prefixes) that smuggle extra commands, auto-approve modes that trust too much, and actions the agent takes through a path the approval logic never sees.",
    defend: "Parse commands fully before approving them, keep auto-approve off for untrusted repos, prefer narrow allow-lists, and update agents promptly when vendors fix permission logic.",
    see: ["sandbox-escape", "rce", "coding-agents", "prompt-injection"],
    aka: ["auto-approve bypass", "permission bypass"],
  },
  "privilege-escalation": {
    term: "Privilege escalation",
    short: "Privilege escalation is gaining more access than you were given. In AI systems it usually happens through an agent acting with its user's or service's permissions: an attacker with little access gets the agent to do something only a more privileged identity could do.",
    how: "This is a confused-deputy problem: the agent holds the power and the attacker supplies the instructions, for example through a database comment, document or ticket the agent reads. Agents running as admins, with broad OAuth scopes or with shared service accounts make the gap large.",
    defend: "Run agents with the least privilege that works, bind actions to the requesting user's permissions, and require approval for administrative operations.",
    see: ["prompt-injection", "credential-theft", "agent-security", "sandbox-escape"],
    aka: ["confused deputy"],
  },
  "data-poisoning": {
    term: "Data poisoning",
    short: "Data poisoning is corrupting the data an AI system learns from or retrieves, so that it behaves the way an attacker wants. It covers training and fine-tuning data, retrieval corpora used for RAG, and the memories agents store for later.",
    how: "An attacker publishes or inserts content that will be collected: web pages, documents in a shared drive, records in a knowledge base, or entries written into an agent's memory. Small amounts can be enough to plant a trigger, bias answers or insert instructions that resurface later.",
    defend: "Track where training and retrieval data comes from, restrict who can write to knowledge bases and agent memory, and test models and indexes for planted triggers.",
    see: ["model-backdoor", "rag", "agent-memory", "model-supply-chain"],
    aka: ["training data poisoning", "RAG poisoning", "memory poisoning"],
  },
  "model-backdoor": {
    term: "Model backdoor",
    short: "A model backdoor is hidden behaviour planted in an AI model that stays dormant until a specific trigger appears in the input, then makes the model do what the attacker chose. The model behaves normally on ordinary tests, which makes backdoors hard to find.",
    how: "Backdoors are planted through poisoned training or fine-tuning data, or by directly editing weights before a model is shared. Triggers can be words, phrases, formatting or dates. Research has shown some backdoors survive further safety training.",
    defend: "Use models from sources you trust, verify weights and provenance, scan downloaded models, and evaluate behaviour on varied and adversarial inputs before deployment.",
    see: ["data-poisoning", "model-supply-chain", "open-weights", "evals"],
    aka: ["trojan model", "sleeper agent"],
  },
  typosquatting: {
    term: "Typosquatting",
    short: "Typosquatting is publishing a malicious package, model, skill or domain under a name that looks like a popular one, so people or AI agents install it by mistake. AI coding tools add a twist: they can suggest package names that do not exist, which attackers then register.",
    how: "Attackers register near-miss names (a swapped letter, a missing hyphen, a different scope) or names that models tend to hallucinate, sometimes called slopsquatting. When a developer or agent installs the wrong name, the malicious code runs with their access.",
    defend: "Verify package names and publishers before installing, use lockfiles and allow-lists for agents, and block installs of very new or unknown packages in automated environments.",
    see: ["malicious-package", "model-supply-chain", "skills", "coding-agents"],
    aka: ["slopsquatting", "package hallucination"],
  },
  "malicious-package": {
    term: "Malicious package",
    short: "A malicious package is a library, plugin, extension, skill or model file published to look useful while carrying code that steals data, opens a backdoor or attacks its user. AI tooling has made registries like npm, PyPI, Hugging Face and skill and MCP marketplaces frequent targets.",
    how: "Malicious packages run code at install, import or load time, or wait for a trigger. They arrive through typosquatting, compromised maintainer accounts, takeovers of abandoned names, or agents that install dependencies automatically.",
    defend: "Pin and review dependencies, use registry scanners, restrict which sources agents may install from, and isolate build and agent environments from long-lived secrets.",
    see: ["typosquatting", "model-supply-chain", "credential-theft", "plugins"],
    aka: ["supply chain malware"],
  },
  "rogue-agents": {
    term: "Rogue agents",
    short: "Rogue agents are AI agents acting outside what their operators or the systems they touch would allow: probing services, misusing tools, crawling aggressively or pursuing goals beyond their task. The term covers both hijacked agents and agents that misbehave on their own.",
    how: "Agents with web access, code execution and long-running autonomy can interact with outside systems in ways nobody reviewed. Problems show up as unexpected edits, attempts to use services as proxies, excessive requests or actions outside an evaluation's scope.",
    defend: "Identify agent traffic clearly, rate-limit and monitor it, constrain agents with network policies and scoped credentials, and log their actions so operators can trace what happened.",
    see: ["agent-security", "browser-agents", "sandbox-escape", "evals"],
    aka: ["agent misbehaviour", "agent abuse"],
  },
  "coding-agents": {
    term: "Coding agents",
    short: "Coding agents are AI tools that read and change code and run commands on a developer's behalf, such as Claude Code, OpenAI Codex, GitHub Copilot's agent and CLI, Gemini CLI and Cursor. They hold a developer's access to repos, terminals and secrets, which makes them a high-value target.",
    how: "Coding agents read untrusted content all day: dependencies, issues, pull requests, docs and web pages. Prompt injection in any of it can lead to command execution, secret theft or malicious commits, and plugins, skills and MCP servers extend the attack surface further.",
    defend: "Run coding agents in sandboxes or dev containers, keep auto-approve off for untrusted repos, scope tokens, review agent changes like any other contributor's, and keep agents updated.",
    see: ["prompt-injection", "approval-bypass", "sandbox-escape", "plugins"],
    aka: ["AI coding assistants", "agentic coding tools"],
  },
  "browser-agents": {
    term: "Browser agents",
    short: "Browser agents are AI agents that operate a web browser for a user: reading pages, clicking, filling forms and completing tasks across sites. Every page they visit is untrusted input, so they are exposed to indirect prompt injection while often holding logged-in sessions.",
    how: "A malicious page, ad, review or email shown in the browser can carry instructions the agent follows, such as visiting another site, entering data or buying something. Because the agent acts with the user's cookies and sessions, a hijack can reach accounts on other sites.",
    defend: "Use separate browser profiles without sensitive sessions, require confirmation for purchases, logins and form submissions, and limit the sites an agent may visit.",
    see: ["indirect-prompt-injection", "rogue-agents", "data-exfiltration", "agent-security"],
    aka: ["computer-use agents", "web agents"],
  },
  mcp: {
    term: "MCP (Model Context Protocol)",
    short: "MCP, the Model Context Protocol, is an open standard for connecting AI assistants and agents to tools and data through servers that expose functions, resources and prompts. It is widely used, so MCP servers, clients, SDKs and registries are now a major part of the AI attack surface.",
    how: "An MCP client gives the model a list of tools from each connected server, and the model decides what to call. Risks include malicious or compromised servers, poisoned tool descriptions, servers with excessive access, weak authentication and OAuth flaws in SDKs, and registries where names or domains can be taken over.",
    defend: "Install servers from trusted publishers, pin versions, review tool descriptions and permissions, keep the official SDKs updated, and isolate servers that touch sensitive systems.",
    see: ["tool-poisoning", "plugins", "skills", "credential-theft"],
    aka: ["Model Context Protocol", "MCP servers"],
  },
  skills: {
    term: "Agent skills",
    short: "Agent skills are packaged instructions, scripts and resources that an AI agent loads to perform a task, such as Anthropic's Agent Skills for Claude. Because a skill tells the agent what to do and can include code, a malicious or tampered skill acts like a malicious package with the agent's access.",
    how: "Skills are shared through marketplaces, repos and organisations. A skill can hide instructions in its text, bundle scripts that run with the agent's permissions, or pull dependencies at runtime. Scanners that review skills can themselves be evaded.",
    defend: "Install skills only from sources you trust, review their instructions and bundled code, and run agents that use third-party skills with limited access.",
    see: ["plugins", "mcp", "malicious-package", "typosquatting"],
    aka: ["Agent Skills", "Claude skills"],
  },
  plugins: {
    term: "Plugins and extensions",
    short: "Plugins and extensions add commands, tools or integrations to AI assistants and coding agents. They run with the host's trust and often its access, so a malicious, compromised or vulnerable plugin can execute code, read secrets or steer the agent.",
    how: "Risk comes from plugins that run code when installed or loaded, auto-install from repo configuration, request broad permissions, or fetch updates from places an attacker can control. In coding agents, a repo can sometimes declare plugins that load without the user noticing.",
    defend: "Disable automatic plugin installation from project files, review plugin permissions, prefer signed or vetted marketplaces, and keep plugin lists short.",
    see: ["skills", "mcp", "malicious-package", "rce"],
    aka: ["extensions", "add-ons"],
  },
  "agent-memory": {
    term: "Agent memory",
    short: "Agent memory is information an AI assistant or agent stores between sessions, such as user preferences, facts and past conversations, and reloads into its context later. If an attacker can write to it, injected instructions persist and keep influencing the agent long after the original attack.",
    how: "Memory can be poisoned through prompt injection that asks the agent to remember something, through shared memory stores, or through third-party memory plugins and packages. Stored memories can also hold sensitive data that later leaks.",
    defend: "Let users see and delete memories, restrict which content may write to memory, treat recalled memory as untrusted input, and vet memory plugins like any other dependency.",
    see: ["data-poisoning", "prompt-injection", "rag", "malicious-package"],
    aka: ["memory poisoning", "persistent memory"],
  },
  rag: {
    term: "RAG (retrieval-augmented generation)",
    short: "RAG, retrieval-augmented generation, is a pattern where an AI system searches a document store and adds the results to the model's prompt before answering. Everything retrieved becomes model input, so the corpus is an injection and data-leak surface.",
    how: "Attackers plant instructions or false facts in documents that will be indexed, or exploit weak access control so a user retrieves documents they should not see. Retrieved text can also carry exfiltration payloads into the answer.",
    defend: "Enforce document-level permissions at retrieval time, control who can add content to indexes, mark retrieved text as untrusted, and monitor for planted instructions.",
    see: ["data-poisoning", "indirect-prompt-injection", "agent-memory", "data-exfiltration"],
    aka: ["retrieval-augmented generation", "RAG poisoning"],
  },
  "model-supply-chain": {
    term: "AI model supply chain",
    short: "The AI model supply chain is everything a deployed model depends on: training data, base models, fine-tunes, weight files, model hubs, conversion tools and the libraries that load them. A compromise anywhere in it can put backdoored weights or malicious code into production.",
    how: "Risks include model files in formats that execute code when loaded, impersonated or compromised hub accounts, poisoned datasets, tampered conversions and quantisations, and vulnerable serving frameworks. Provenance is often thin: few models ship signed weights or full data lineage.",
    defend: "Prefer safe weight formats such as safetensors, pull models from verified publishers, pin and hash what you deploy, scan model files, and record provenance.",
    see: ["model-backdoor", "open-weights", "malicious-package", "data-poisoning"],
    aka: ["ML supply chain", "AI supply chain"],
  },
  "open-weights": {
    term: "Open-weight models",
    short: "Open-weight models are AI models whose trained weights are published for anyone to download, run and fine-tune, such as Llama, Qwen, Mistral, DeepSeek and GLM releases. Their safety controls can be removed by fine-tuning, so their capabilities, especially in cyber offense, matter for security.",
    how: "Once weights are public, refusals and safeguards can be trained away and the model run without monitoring. Security work on open weights looks at what the models can do unaided, how easily safeguards are stripped, and whether downloaded weights are what they claim to be.",
    defend: "Assess open models' capabilities before deployment, verify weights and publishers, and do not assume vendor safety tuning will hold once a model is in someone else's hands.",
    see: ["model-supply-chain", "cyber-capability", "evals", "model-backdoor"],
    aka: ["open-source models", "open models"],
  },
  "agent-security": {
    term: "AI agent security",
    short: "AI agent security is the practice of keeping AI agents, models that plan and take actions with tools, from being hijacked, misused or causing harm. It combines classic controls such as least privilege, sandboxing and auditing with defences against prompt injection and tool abuse.",
    how: "An agent's risk is roughly what it can reach multiplied by how much untrusted content it reads. The key questions are what tools and data it has, who can influence its input, which actions need human approval, and whether its actions are logged and attributable.",
    defend: "Inventory agents and their permissions, apply least privilege, isolate execution, gate risky actions behind approval, monitor agent activity, and adopt shared standards for observing and controlling agent actions.",
    see: ["prompt-injection", "guardrails", "rogue-agents", "coding-agents"],
    aka: ["agentic AI security", "agent safety"],
  },
  guardrails: {
    term: "Guardrails",
    short: "Guardrails are controls placed around an AI model to check or restrict what goes in and comes out, such as prompt-injection detectors, content classifiers, PII filters, tool-call policies and output validators. They reduce risk but can be bypassed, so they work best alongside hard limits.",
    how: "Guardrails run before the model (screening inputs), after it (screening outputs) or around actions (allowing, denying or modifying tool calls). They can be rules, classifiers or another model acting as a judge.",
    defend: "Use guardrails as one layer, test them against current bypass techniques, measure false positives, and enforce critical limits (permissions, sandboxes, approvals) outside the model.",
    see: ["guardrail-bypass", "detection", "agent-security", "jailbreak"],
    aka: ["AI guardrails", "safety filters"],
  },
  detection: {
    term: "Detection",
    short: "Detection in AI security is spotting attacks on or through AI systems as they happen: prompt-injection attempts, jailbreaks, malicious tool calls, data exfiltration and abuse of AI services. It covers classifiers on model inputs and outputs and the logging and monitoring around agents.",
    how: "Approaches include trained classifiers, canary tokens, rules for suspicious tool sequences, anomaly detection on agent behaviour, and scanning content before it reaches a model. Detection quality is measured by catch rate and false positives on realistic attacks.",
    defend: "Log prompts, tool calls and agent actions with enough context to investigate, alert on high-risk patterns, and evaluate detectors against adaptive attacks rather than fixed test sets.",
    see: ["guardrails", "threat-intel", "evals", "agent-security"],
    aka: ["monitoring", "prompt injection detection"],
  },
  "red-team": {
    term: "AI red teaming",
    short: "AI red teaming is attacking your own AI system before others do: probing models, applications and agents for jailbreaks, prompt injection, data leaks, unsafe actions and harmful outputs. It ranges from manual expert testing to automated attack tools and scored campaigns.",
    how: "Red teams define what must not happen, then try to make it happen through crafted prompts, poisoned content, malicious tools and multi-step agent scenarios. Findings feed fixes, guardrails and regression tests.",
    defend: "Red-team before launch and after major changes, include indirect injection and tool abuse rather than only chat prompts, and turn findings into automated tests.",
    see: ["evals", "jailbreak", "prompt-injection", "guardrail-bypass"],
    aka: ["red teaming", "adversarial testing"],
  },
  evals: {
    term: "AI security evals",
    short: "AI security evals are structured tests that measure how a model or agent behaves under attack or on security tasks, for example its resistance to prompt injection, its willingness to cause harm, or its ability to find and exploit vulnerabilities. Labs and government institutes publish them to compare systems.",
    how: "An eval fixes a set of tasks or attacks, a scoring method and an environment, often a sandbox for agents, then reports rates such as attack success or task completion. Results depend heavily on setup, so the method matters as much as the score.",
    defend: "Read the method before trusting a number, run evals that match your deployment, and repeat them when models or prompts change.",
    see: ["red-team", "cyber-capability", "detection", "rogue-agents"],
    aka: ["evaluations", "benchmarks"],
  },
  "cyber-capability": {
    term: "Cyber capability",
    short: "Cyber capability is how well an AI model can carry out offensive or defensive security work, such as finding vulnerabilities, writing exploits, moving through networks or analysing malware. Labs and AI safety institutes measure it to decide how models are released and safeguarded.",
    how: "Capability is tested with capture-the-flag challenges, vulnerability discovery tasks, cyber ranges and long multi-step scenarios run by agents. Results feed lab safety frameworks, access tiers for security researchers and government assessments.",
    defend: "Expect attackers to have capable models, including open-weight ones; use the same models defensively, and watch published assessments when choosing what to deploy and how to restrict it.",
    see: ["evals", "ai-enabled-offense", "open-weights", "red-team"],
    aka: ["offensive cyber capability", "cyber evals"],
  },
  "threat-intel": {
    term: "AI threat intelligence",
    short: "AI threat intelligence is reporting on how real attackers use, target or abuse AI systems, drawn from incidents, provider abuse reports and security vendors' telemetry. It separates what is happening in the wild from what is only shown in research.",
    how: "Sources include AI providers' reports on accounts they banned, security firms tracking campaigns that use AI tools, and vulnerability trend analyses of AI frameworks. Good reports name the actor, the technique and the evidence.",
    defend: "Use threat reports to prioritise: patch the AI frameworks and products being exploited now, and plan for the techniques attackers are actually adopting.",
    see: ["ai-enabled-offense", "detection", "cyber-capability", "rogue-agents"],
    aka: ["threat intelligence", "AI threat reports"],
  },
  "ai-enabled-offense": {
    term: "AI-enabled offense",
    short: "AI-enabled offense is attackers using AI models to make attacks faster, cheaper or larger: writing phishing and malware, researching targets, finding vulnerabilities and running parts of intrusions autonomously. It is about AI as the attacker's tool rather than the target.",
    how: "Reported uses range from drafting lures and translating content to agents that scan, exploit and move laterally with little human input. Providers counter by monitoring for abuse, banning accounts and tiering access to the most capable cyber features.",
    defend: "Assume higher volumes and better-quality attacks, shorten patch cycles, and use AI defensively for detection and triage.",
    see: ["threat-intel", "cyber-capability", "rogue-agents", "credential-theft"],
    aka: ["AI-powered attacks", "offensive AI"],
  },
};

/** Index sections on /learn/. A tag missing here lands under "More terms". */
export const GLOSSARY_GROUPS: { label: string; tags: TopicTag[] }[] = [
  { label: "Attack techniques", tags: ["prompt-injection", "indirect-prompt-injection", "jailbreak", "guardrail-bypass", "tool-poisoning", "data-exfiltration", "credential-theft", "rce", "zero-click", "sandbox-escape", "approval-bypass", "privilege-escalation", "data-poisoning", "model-backdoor", "typosquatting", "malicious-package", "rogue-agents"] },
  { label: "Attack surfaces", tags: ["coding-agents", "browser-agents", "mcp", "skills", "plugins", "agent-memory", "rag", "model-supply-chain", "open-weights"] },
  { label: "Defense and measurement", tags: ["agent-security", "guardrails", "detection", "red-team", "evals", "cyber-capability", "threat-intel", "ai-enabled-offense"] },
];

/** "What is prompt injection?", "What are coding agents?", "What is MCP?" */
export function whatIs(t: TopicTag): string {
  const plain = GLOSSARY[t].term.replace(/ \(.*\)$/, "");
  const lead = /^[A-Z]{2}/.test(plain) ? plain : plain[0].toLowerCase() + plain.slice(1);
  return `What ${/[^s]s$/.test(plain) ? "are" : "is"} ${lead}?`;
}

/** The term in running text: "prompt injection", "MCP". */
export const termInText = (t: TopicTag) => {
  const plain = GLOSSARY[t].term.replace(/ \(.*\)$/, "");
  return /^[A-Z]{2}/.test(plain) ? plain : plain[0].toLowerCase() + plain.slice(1);
};

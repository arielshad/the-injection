/**
 * Share and "Ask AI" links. Plain intent URLs: nothing loads from these
 * services until a reader clicks, so no third party sees the visit before then.
 */

export interface ShareTarget {
  id: string;
  label: string;
  href: string;
}

const enc = encodeURIComponent;

export function shareLinks(url: string, title: string): ShareTarget[] {
  return [
    { id: "x", label: "X", href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}` },
    { id: "bluesky", label: "Bluesky", href: `https://bsky.app/intent/compose?text=${enc(`${title} ${url}`)}` },
    { id: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { id: "reddit", label: "Reddit", href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}` },
    { id: "hn", label: "Hacker News", href: `https://news.ycombinator.com/submitlink?u=${enc(url)}&t=${enc(title)}` },
    { id: "email", label: "Email", href: `mailto:?subject=${enc(title)}&body=${enc(url)}` },
  ];
}

/**
 * The question a defender would ask, with the page URL so the assistant
 * reads (and cites) the story instead of guessing. Kept short: some
 * assistants truncate long prefilled prompts.
 */
export function askPrompt(opts: { url: string; title: string; context?: string; question?: string }): string {
  return [
    `Read ${opts.url} and explain "${opts.title}" to me.`,
    opts.context,
    opts.question ?? "Does it affect my setup, and what should I check or change first? Cite the primary sources the page links.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Assistants that accept a prefilled prompt in the URL. Gemini does not, so it is left out. */
export function askAiLinks(prompt: string): ShareTarget[] {
  const q = enc(prompt);
  return [
    { id: "chatgpt", label: "ChatGPT", href: `https://chatgpt.com/?q=${q}` },
    { id: "claude", label: "Claude", href: `https://claude.ai/new?q=${q}` },
    { id: "perplexity", label: "Perplexity", href: `https://www.perplexity.ai/search?q=${q}` },
    { id: "grok", label: "Grok", href: `https://grok.com/?q=${q}` },
  ];
}

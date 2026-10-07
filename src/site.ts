/** One place for the name, so renaming the site is a one-line change. */
export const SITE = {
  name: "The Injection",
  shortName: "Injection",
  tagline: "AI security, verified and explained.",
  description:
    "A daily feed of AI security news and research: prompt injection, agent and MCP supply chain, jailbreaks, vulnerabilities and lab safety claims. Every item is sourced, credited and explained in plain English.",
  url: (import.meta.env.SITE_URL || process.env.SITE_URL || "https://theinjection.dev").replace(/\/$/, ""),
  locale: "en",
  twitter: "",
};

export const abs = (path: string) => SITE.url + (path.startsWith("/") ? path : `/${path}`);

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
  /** Public contact address. Empty until the owner sets one; pages and JSON-LD only show it when set. */
  contactEmail: (import.meta.env.CONTACT_EMAIL || process.env.CONTACT_EMAIL || "") as string,
  /** Public feedback: corrections, story tips (issues) and questions (discussions). */
  feedbackUrl: "https://github.com/arielshad/the-injection-feedback",
  /**
   * Cookieless, self-hosted Umami (see the privacy page). Off unless UMAMI_WEBSITE_ID
   * is set at build; the host serves only the tracker script and its collect endpoint.
   */
  analytics: {
    websiteId: (import.meta.env.UMAMI_WEBSITE_ID || process.env.UMAMI_WEBSITE_ID || "") as string,
    host: ((import.meta.env.UMAMI_HOST || process.env.UMAMI_HOST || "https://stats.theinjection.dev") as string).replace(/\/$/, ""),
  },
};

export const abs = (path: string) => SITE.url + (path.startsWith("/") ? path : `/${path}`);

/** Base path for GitHub Pages project sites (e.g. "/the-injection"), "" on a custom domain. */
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
/** Site-relative link that respects the base path. Use for every internal href. */
export const u = (path: string) => BASE + (path.startsWith("/") ? path : `/${path}`);

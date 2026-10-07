import type { Severity } from "@/data/schema";

/**
 * Every severity has a shape as well as a colour (GitLab's security dashboard
 * does the same), so the scale still reads in greyscale and for colour-blind
 * readers. Only critical gets a filled badge; everything else is glyph + label.
 */
export const SEV_GLYPH: Record<Severity, string> = {
  critical: "●",
  high: "◆",
  medium: "▲",
  low: "■",
  info: "○",
};

export const SEV_TEXT: Record<Severity, string> = {
  critical: "text-sev-critical",
  high: "text-sev-high",
  medium: "text-sev-medium",
  low: "text-sev-low",
  info: "text-sev-info",
};

export const SEV_BORDER: Record<Severity, string> = {
  critical: "border-l-sev-critical",
  high: "border-l-sev-high",
  medium: "border-l-sev-medium",
  low: "border-l-sev-low",
  info: "border-l-sev-info",
};

export const SEV_BG: Record<Severity, string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  info: "bg-sev-info",
};

export const SEV_SHORT: Record<Severity, string> = {
  critical: "Crit",
  high: "High",
  medium: "Med",
  low: "Low",
  info: "Info",
};

export const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

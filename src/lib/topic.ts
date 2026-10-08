import type { Category } from "@/data/schema";

/** Topic colours, separate from severity: they drive covers, kickers and section rules. */
export const TOPIC: Record<Category, { bg: string; ink: string }> = {
  vulnerability: { bg: "#1d3557", ink: "#f1e9da" },
  attack: { bg: "#5b1f4a", ink: "#f6d6e6" },
  "supply-chain": { bg: "#1f5c47", ink: "#d9f2e6" },
  research: { bg: "#8a4b14", ink: "#fbe7cf" },
  incident: { bg: "#7a1730", ink: "#ffd9df" },
  tool: { bg: "#2b4c6f", ink: "#dbe9f7" },
  benchmark: { bg: "#3f3470", ink: "#e5ddff" },
  "lab-safety": { bg: "#2f3a3d", ink: "#e3ecee" },
  talk: { bg: "#6b3a1d", ink: "#fbe2cf" },
};


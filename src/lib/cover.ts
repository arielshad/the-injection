/**
 * Generated covers for items without an image. Deterministic per id (same
 * story, same cover on every build) but varied across stories: the colour
 * field and the pattern are both drawn from the id's hash, so a run of five
 * CVEs does not read as five copies of one tile.
 *
 * Returns plain SVG markup so the Astro cover and the React feed thumbnail
 * draw exactly the same art.
 */

/** Deep, saturated fields that sit on graphite without glowing. */
const FIELDS = [
  { bg: "#1D3557", ink: "#DCE7F5" }, // navy
  { bg: "#4B1F45", ink: "#F3D9EC" }, // plum
  { bg: "#1F4D3E", ink: "#D5F0E3" }, // forest
  { bg: "#6A3417", ink: "#FBE3CF" }, // rust
  { bg: "#5A1628", ink: "#FFD9E0" }, // wine
  { bg: "#24425F", ink: "#D7E8F7" }, // steel
  { bg: "#372C66", ink: "#E3DDFF" }, // indigo
  { bg: "#2E3A1C", ink: "#E6F2C9" }, // moss
];

export interface CoverArt {
  bg: string;
  ink: string;
  svg: string;
  text: string;
}

function seeded(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
}

export function coverText(item: { cve?: string; affected?: string[]; org: string }) {
  const pick = item.cve ?? item.affected?.[0] ?? item.org;
  return pick.length > 18 ? (item.affected?.find((a) => a.length <= 18) ?? item.org) : pick;
}

export function coverArt(item: { id: string; cve?: string; affected?: string[]; org: string }): CoverArt {
  const rand = seeded(item.id);
  const field = FIELDS[Math.floor(rand() * FIELDS.length)];
  const ink = field.ink;
  const pattern = Math.floor(rand() * 4);
  const parts: string[] = [];

  if (pattern === 0) {
    // Halftone wave: dot size follows a seeded interference pattern.
    const fx = 2 + rand() * 3, fy = 1.6 + rand() * 2.4, ph = rand() * 6;
    for (let y = 0; y < 13; y++)
      for (let x = 0; x < 23; x++) {
        const r = Math.max(0, (Math.sin(x / fx + ph) + Math.cos(y / fy + ph)) * 1.7 + 0.4);
        if (r > 0.2) parts.push(`<circle cx="${x * 18 + 9}" cy="${y * 18 + 9}" r="${r.toFixed(2)}" fill="${ink}" opacity="0.28"/>`);
      }
  } else if (pattern === 1) {
    // Scanlines of random length, like a redacted page.
    for (let i = 0; i < 46; i++) parts.push(`<rect x="0" y="${i * 5}" width="${(400 * (0.2 + rand() * 0.8)).toFixed(0)}" height="1.8" fill="${ink}" opacity="0.22"/>`);
  } else if (pattern === 2) {
    // Grid with a few lit cells.
    for (let i = 0; i <= 11; i++) parts.push(`<line x1="${i * 36}" y1="0" x2="${i * 36}" y2="225" stroke="${ink}" stroke-width="0.6" opacity="0.28"/>`);
    for (let i = 0; i <= 10; i++) parts.push(`<line x1="0" y1="${i * 22}" x2="400" y2="${i * 22}" stroke="${ink}" stroke-width="0.6" opacity="0.28"/>`);
    for (let i = 0; i < 9; i++) parts.push(`<rect x="${Math.floor(rand() * 11) * 36}" y="${Math.floor(rand() * 10) * 22}" width="36" height="22" fill="${ink}" opacity="${(0.12 + rand() * 0.18).toFixed(2)}"/>`);
  } else {
    // Concentric rings off one corner, like a radar sweep.
    const cx = rand() < 0.5 ? 0 : 400, cy = rand() < 0.5 ? 0 : 225;
    for (let i = 1; i <= 22; i++) parts.push(`<circle cx="${cx}" cy="${cy}" r="${i * 22}" fill="none" stroke="${ink}" stroke-width="${i % 4 === 0 ? 1.4 : 0.6}" opacity="0.25"/>`);
  }

  const svg = `<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%">${parts.join("")}</svg>`;
  return { bg: field.bg, ink, svg, text: coverText(item) };
}

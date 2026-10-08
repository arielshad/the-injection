/**
 * Per-page share cards (og:image / twitter:image), rendered at build time.
 *
 * Link unfurlers (Slack, X, LinkedIn, iMessage) only take raster images, so
 * the cover art is drawn as the background, satori lays out the text on top,
 * and sharp flattens both into one 1200x630 PNG. The background uses the
 * story's own cover field and pattern, so two stories never unfurl alike.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import sharp from "sharp";
import { coverArt } from "@/lib/cover";
import { CATEGORY_META, SEVERITY_META } from "@/data/categories";
import type { Item } from "@/data/schema";
import { SITE } from "@/site";
import { fmtDate } from "@/lib/slim";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const SEV_COLOR = { critical: "#FF3B4E", high: "#FF8A3D", medium: "#E8C547", low: "#7FA7C9", info: "#8A939B" } as const;
const PAPER = "#0E1012";
const ACID = "#D4FF3A";

// Satori reads TTF/OTF/WOFF, not WOFF2, so the static Fontsource packages supply the files.
const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => readFileSync(require.resolve(`${pkg}/files/${file}`));
let fonts: Parameters<typeof satori>[1]["fonts"] | undefined;
const loadFonts = () =>
  (fonts ??= [
    ...(["latin", "latin-ext"] as const).flatMap((sub) => [
      { name: "Hanken", data: font("@fontsource/hanken-grotesk", `hanken-grotesk-${sub}-600-normal.woff`), weight: 600 as const, style: "normal" as const },
      { name: "Hanken", data: font("@fontsource/hanken-grotesk", `hanken-grotesk-${sub}-400-normal.woff`), weight: 400 as const, style: "normal" as const },
      { name: "Martian", data: font("@fontsource/martian-mono", `martian-mono-${sub}-500-normal.woff`), weight: 500 as const, style: "normal" as const },
    ]),
  ]);

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | false | undefined)[]): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.filter((c) => c !== false && c !== undefined) },
});

/** Headline size steps down as titles get longer, so every title fits in three lines. */
const titleSize = (t: string) => (t.length <= 48 ? 76 : t.length <= 64 ? 66 : 58);

interface Card {
  /** Cover field and pattern to draw behind the text. */
  art: { bg: string; ink: string; svg: string };
  kicker: { color: string; label: string }[];
  date?: string;
  title: string;
  byline?: string;
}

async function render(card: Card): Promise<Buffer> {
  const { art } = card;
  const overlay = h(
    "div",
    { width: OG_WIDTH, height: OG_HEIGHT, flexDirection: "column", color: "#FFFFFF", fontFamily: "Hanken" },
    h(
      "div",
      { flex: 1, flexDirection: "column", padding: "52px 64px 40px", backgroundImage: `linear-gradient(90deg, ${art.bg} 0%, ${art.bg}E6 55%, ${art.bg}00 100%)` },
      h(
        "div",
        { alignItems: "center", fontFamily: "Martian", fontSize: 20, letterSpacing: 2, textTransform: "uppercase" },
        ...card.kicker.flatMap((k, i) => [
          i > 0 && h("div", { margin: "0 14px", color: art.ink, opacity: 0.5 }, "/"),
          h("div", { alignItems: "center", color: i === 0 ? k.color : art.ink }, i === 0 && h("div", { width: 16, height: 16, borderRadius: 3, backgroundColor: k.color, marginRight: 12 }), k.label),
        ]),
        card.date && h("div", { marginLeft: "auto", color: art.ink, opacity: 0.8 }, card.date),
      ),
      h("div", { marginTop: "auto", fontSize: titleSize(card.title), fontWeight: 600, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: 1040 }, card.title),
      card.byline && h("div", { marginTop: 26, fontSize: 26, fontWeight: 400, color: art.ink, opacity: 0.9, maxWidth: 1040 }, card.byline),
    ),
    h(
      "div",
      { height: 84, alignItems: "center", padding: "0 64px", backgroundColor: PAPER, fontFamily: "Martian", fontSize: 20, letterSpacing: 2, textTransform: "uppercase" },
      h("div", { color: "#E3E6E8", fontSize: 24, letterSpacing: 3 }, SITE.name, h("span", { color: ACID }, "_")),
      h("div", { marginLeft: "auto", color: "#7D868F", textTransform: "none", letterSpacing: 0.5 }, new URL(SITE.url).host),
    ),
  );

  const svg = await satori(overlay as never, { width: OG_WIDTH, height: OG_HEIGHT, fonts: loadFonts() });
  const background = art.svg
    .replace(/ aria-hidden="true" style="[^"]*"/, ` width="${OG_WIDTH}" height="${OG_HEIGHT}"`)
    .replace(">", `><rect width="400" height="225" fill="${art.bg}"/>`);
  return sharp(Buffer.from(background))
    .composite([{ input: Buffer.from(svg) }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
}

const credits = (item: Item) => {
  const names = item.credits.map((c) => c.name);
  return names.length > 3 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(", ");
};

export function itemCard(item: Item): Promise<Buffer> {
  const by = credits(item);
  return render({
    art: coverArt(item),
    kicker: [
      { color: SEV_COLOR[item.severity], label: SEVERITY_META[item.severity].label },
      { color: "", label: CATEGORY_META[item.categories[0]].label },
      ...(item.cve ? [{ color: "", label: item.cve }] : []),
    ],
    date: fmtDate(item.date),
    title: item.title,
    byline: by && by !== item.org ? `${item.org} · Research by ${by}` : item.org,
  });
}

export function categoryCard(cat: keyof typeof CATEGORY_META, count: number): Promise<Buffer> {
  const meta = CATEGORY_META[cat];
  return render({
    art: coverArt({ id: `category-${cat}`, org: meta.label }),
    kicker: [{ color: ACID, label: "Category" }, { color: "", label: `${count} ${count === 1 ? "story" : "stories"}` }],
    title: `${meta.label}: AI security news`,
    byline: `${meta.blurb}.`,
  });
}

/** Alt text that says what the card shows, for og:image:alt and twitter:image:alt. */
export const itemCardAlt = (item: Item) =>
  `${item.title}. ${SEVERITY_META[item.severity].label} severity ${CATEGORY_META[item.categories[0]].label.toLowerCase()} story from ${item.org}, on ${SITE.name}.`;

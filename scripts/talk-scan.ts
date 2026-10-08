/**
 * Discovery feed for talks and videos: security conferences and strong
 * security voices on YouTube, uploads inside the window, with view counts.
 *
 * The talk bar in prompts/update-feed.md decides what ships. This script only
 * lists what was uploaded, how many views it has, and whether the title looks
 * like AI security. Influencer titles are often clickbait ("oh my god"), so a
 * keyword miss on an influencer video is NOT a reason to skip it: open it.
 *
 * Two ways to read a channel, in order:
 *   1. RSS (youtube.com/feeds/videos.xml): exact upload time and views.
 *      ai-tldr's CI reads it from GitHub runners (its SWEEP_MEMORY 2026-06-13).
 *   2. The channel's /videos page: views and a relative age ("6 days ago").
 *      Used when RSS fails (it returned 404 from some networks in 2026-10).
 *      `uploadDate` is then today minus the age, `dateSource: "relative"`,
 *      accurate to about a day: the prompt says how to treat it.
 * Never scrape the watch page for dates: YouTube bot-walls it in CI.
 *
 * Channel ids were read from each channel's own page on 2026-10-08. Add a
 * channel only with an id read the same way, never from memory.
 *
 * Usage: npx tsx scripts/talk-scan.ts [--window-days N]
 * Prints JSON: { since, channelsRead, channelsFailed[], videos[] }, each video:
 *   { kind, channel, channelUrl, channelId, youtubeId, watchUrl, title, views,
 *     uploadDate, dateSource, ageDays, aiSecurityTitle, thumbnailUrl }
 * sorted conference talks by views, then influencer videos by views.
 * Exit 0 when at least one channel was read, 1 otherwise.
 */
import { DEFAULT_WINDOW_DAYS } from "./lib/common.ts";

type Kind = "conference" | "influencer";
interface Channel { name: string; handle: string; id: string; kind: Kind }

export const CHANNELS: Channel[] = [
  // Conferences and research channels: a talk needs the viral signal or a second signal.
  { name: "DEF CON", handle: "DEFCONConference", id: "UC6Om9kAkl32dWlDSNlDS9Iw", kind: "conference" },
  { name: "Black Hat", handle: "BlackHatOfficialYT", id: "UCJ6q9Ie29ajGqKApbLqfBOg", kind: "conference" },
  { name: "AI Village", handle: "AIVillage", id: "UCBUw0vVET-kB7LPj_XsNQ9Q", kind: "conference" },
  { name: "OWASP Foundation", handle: "OWASPGLOBAL", id: "UCe8j61ABYDuPTdtjItD2veA", kind: "conference" },
  { name: "USENIX", handle: "USENIX", id: "UCHwLg2XZDZL3OvrwpzleKjw", kind: "conference" },
  { name: "media.ccc.de", handle: "mediacccde", id: "UC2TXq_t06Hjdr2g_KdKpHQg", kind: "conference" },
  { name: "BSides San Francisco", handle: "BSidesSF", id: "UCWemrSP6Aba171jXReCz_Qg", kind: "conference" },
  { name: "OffensiveCon", handle: "OffensiveCon", id: "UCMNvAtT4ak2azKNk6UlB1QQ", kind: "conference" },
  { name: "Hack In The Box", handle: "HITBSecConf", id: "UC0BJVNTIEbG8CLG-xVVWJnA", kind: "conference" },
  { name: "x33fcon", handle: "x33fcon", id: "UC8wesSvHdlNXVZgSy_UU_Ug", kind: "conference" },
  { name: "SANS Institute", handle: "SANSInstitute", id: "UC2uPNhGken-ogEpJDi4ly6w", kind: "conference" },
  { name: "Trail of Bits", handle: "TrailofBits", id: "UCWFJTyr9zC5YRkKO_C3v4ew", kind: "conference" },
  // Strong security voices: the channel itself is a signal; the video still needs substance.
  { name: "Embrace The Red", handle: "embracethered", id: "UCSwcJXQWE6GWu9IKc0QwO5g", kind: "influencer" },
  { name: "John Hammond", handle: "_JohnHammond", id: "UCVeW9qkBjo3zosnqUbG7CFw", kind: "influencer" },
  { name: "LiveOverflow", handle: "LiveOverflow", id: "UClcE-kVhqyiHCcjYwcpfj9w", kind: "influencer" },
  { name: "Low Level", handle: "LowLevelTV", id: "UC6biysICWOJ-C3P4Tyeggzg", kind: "influencer" },
  { name: "Jason Haddix", handle: "jhaddix", id: "UCk0f0svao7AKeK3RfiWxXEA", kind: "influencer" },
  { name: "Unsupervised Learning", handle: "unsupervised-learning", id: "UCnCikd0s4i9KoDtaHPlK-JA", kind: "influencer" },
  { name: "IppSec", handle: "ippsec", id: "UCa6eh7gCkpPo5XXUDfygQQA", kind: "influencer" },
  { name: "Seytonic", handle: "Seytonic", id: "UCW6xlqxSY3gGur4PkGPEUeA", kind: "influencer" },
  { name: "NetworkChuck", handle: "NetworkChuck", id: "UC9x0AN7BWHpCDHSm9NiJFJQ", kind: "influencer" },
  { name: "David Bombal", handle: "davidbombal", id: "UCP7WmQ_U4GB3K51Od9QvM0w", kind: "influencer" },
];

/** A title hint only. Used to sort, never to drop an influencer video. */
const AI_SECURITY = /\b(ai|a\.i\.|llm|llms|gpt|chatgpt|claude|gemini|copilot|cursor|codex|agent|agents|agentic|mcp|prompt|jailbreak|model|models|machine learning|ml|deepfake|vibe ?cod|openai|anthropic|deepseek|hugging ?face)/i;

const args = process.argv.slice(2);
const wi = args.indexOf("--window-days");
const windowDays = wi >= 0 ? Number(args[wi + 1]) : DEFAULT_WINDOW_DAYS;
const nowMs = Date.now();
const sinceMs = nowMs - windowDays * 86_400_000;
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface TalkVideo {
  kind: Kind;
  channel: string;
  channelUrl: string;
  channelId: string;
  youtubeId: string;
  watchUrl: string;
  title: string;
  views: number | null;
  uploadDate: string;
  dateSource: "rss" | "relative";
  ageDays: number;
  aiSecurityTitle: boolean;
  thumbnailUrl: string;
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function build(c: Channel, youtubeId: string, title: string, views: number | null, uploadMs: number, src: "rss" | "relative"): TalkVideo {
  return {
    kind: c.kind,
    channel: c.name,
    channelUrl: `https://www.youtube.com/@${c.handle}`,
    channelId: c.id,
    youtubeId,
    watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
    title,
    views,
    uploadDate: new Date(uploadMs).toISOString().slice(0, 10),
    dateSource: src,
    ageDays: Math.floor((nowMs - uploadMs) / 86_400_000),
    aiSecurityTitle: AI_SECURITY.test(title),
    thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
  };
}

async function viaRss(c: Channel): Promise<TalkVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`, {
    headers: { "User-Agent": "TheInjectionSweep/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`rss ${res.status}`);
  const xml = await res.text();
  const out: TalkVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const published = Date.parse(entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? "");
    if (!id || !Number.isFinite(published) || published < sinceMs) continue;
    const title = decode(entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    const views = Number(entry.match(/<media:statistics views="(\d+)"/)?.[1] ?? NaN);
    out.push(build(c, id, title, Number.isFinite(views) ? views : null, published, "rss"));
  }
  return out;
}

/** "1.2 thousand views", "3 million views", "523 views" -> number. */
function parseViews(label: string | undefined): number | null {
  const m = label?.match(/([\d.,]+)\s*(thousand|million|billion)?\s+views?/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  const mult = { thousand: 1e3, million: 1e6, billion: 1e9 }[(m[2] ?? "").toLowerCase() as "thousand"] ?? 1;
  return Math.round(n * mult);
}

/** "6 days ago", "2 weeks ago", "5 hours ago", "Streamed 3 days ago" -> age in ms. */
function parseAge(label: string | undefined): number | null {
  const m = label?.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  if (!m) return null;
  const unit = { second: 1e3, minute: 6e4, hour: 3.6e6, day: 8.64e7, week: 6.048e8, month: 2.592e9, year: 3.1536e10 }[
    m[2].toLowerCase() as "day"
  ];
  return Number(m[1]) * unit;
}

async function viaPage(c: Channel): Promise<TalkVideo[]> {
  const res = await fetch(`https://www.youtube.com/channel/${c.id}/videos`, {
    headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`page ${res.status}`);
  const html = await res.text();
  const raw = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
  if (!raw) throw new Error("page has no ytInitialData (consent wall?)");
  const lockups: any[] = [];
  const walk = (o: any): void => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      if (o.lockupViewModel) lockups.push(o.lockupViewModel);
      else Object.values(o).forEach(walk);
    }
  };
  walk(JSON.parse(raw));
  const out: TalkVideo[] = [];
  for (const l of lockups) {
    if (l.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO" || !l.contentId) continue;
    const md = l.metadata?.lockupMetadataViewModel;
    const parts: any[] = (md?.metadata?.contentMetadataViewModel?.metadataRows ?? []).flatMap((r: any) => r.metadataParts ?? []);
    const labels = parts.map((p) => p.accessibilityLabel ?? p.text?.content ?? "");
    const age = labels.map(parseAge).find((a) => a !== null) ?? null;
    if (age === null) continue;
    const uploadMs = nowMs - age;
    if (uploadMs < sinceMs) continue;
    const views = labels.map(parseViews).find((v) => v !== null) ?? null;
    out.push(build(c, l.contentId, md?.title?.content ?? "", views, uploadMs, "relative"));
  }
  return out;
}

const videos: TalkVideo[] = [];
const channelsFailed: { channel: string; error: string }[] = [];
let channelsRead = 0;
for (const c of CHANNELS) {
  try {
    let got: TalkVideo[];
    try {
      got = await viaRss(c);
    } catch {
      got = await viaPage(c);
    }
    channelsRead++;
    videos.push(...got);
  } catch (err) {
    channelsFailed.push({ channel: c.name, error: (err as Error).message });
  }
}

const rank = (v: TalkVideo) => (v.kind === "conference" ? 0 : 1);
videos.sort((a, b) => rank(a) - rank(b) || Number(b.aiSecurityTitle) - Number(a.aiSecurityTitle) || (b.views ?? 0) - (a.views ?? 0));
console.log(JSON.stringify({ since: new Date(sinceMs).toISOString().slice(0, 10), channelsRead, channelsFailed, videos }, null, 2));
if (channelsRead === 0) {
  console.error("talk-scan: no channel could be read. Say so in the sweep summary.");
  process.exit(1);
}

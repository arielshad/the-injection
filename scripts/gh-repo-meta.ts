/**
 * Verified facts for one GitHub repo, for `tool` items about open-source
 * releases. Ported from ai-tldr's gh-repo-meta.ts, plus release dates and the
 * owner's display name (for credits) and a 7-day window check (for `date`).
 *
 * Usage: npx tsx scripts/gh-repo-meta.ts <owner/repo | https://github.com/owner/repo>
 *        [--window-days N]
 *
 * Prints JSON on stdout:
 *
 *   { fullName, htmlUrl, description, homepage, stars, forks, language,
 *     license, topics[], fork, archived, createdAt, pushedAt,
 *     owner: { login, type, name, htmlUrl, blog },
 *     releases: { count, countCapped, first: { tag, publishedAt, url } | null,
 *                 latest: { tag, publishedAt, url } | null },
 *     ogImageUrl,
 *     window: { oldestAllowedDate, createdInWindow, firstReleaseInWindow,
 *               latestReleaseInWindow } }
 *
 * `stars` is a snapshot: it goes stale, so never put it in prose. The window
 * block is a fact check for Hard Rule 3, not a recommendation: an old repo
 * with a new major release is about that release; an old repo with neither
 * is not news. Reads GITHUB_TOKEN when set (5000 req/h instead of 60).
 *
 * Exit 0 on success, 1 when the repo cannot be read.
 */
import { DEFAULT_WINDOW_DAYS } from "./lib/common.ts";

const args = process.argv.slice(2);
const wi = args.indexOf("--window-days");
const windowDays = wi >= 0 ? Number(args[wi + 1]) : DEFAULT_WINDOW_DAYS;
const raw = args.find((a, i) => !a.startsWith("--") && (wi < 0 || i !== wi + 1));
if (!raw) {
  console.error("usage: npx tsx scripts/gh-repo-meta.ts <owner/repo> [--window-days N]");
  process.exit(1);
}

let slug = raw;
if (slug.startsWith("http")) {
  const parts = new URL(slug).pathname.split("/").filter(Boolean);
  if (parts.length >= 2) slug = `${parts[0]}/${parts[1]}`;
}
slug = slug.replace(/\.git$/, "");
if (!/^[\w.-]+\/[\w.-]+$/.test(slug)) {
  console.error(`invalid repo slug: ${slug}`);
  process.exit(1);
}

const headers: Record<string, string> = {
  "User-Agent": "TheInjectionSweep/1.0",
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function api(path: string): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const hint = res.status === 403 || res.status === 429 ? " (rate limit? set GITHUB_TOKEN)" : "";
    throw new Error(`github api ${res.status} for ${path}${hint}`);
  }
  return res;
}

interface Release {
  tag_name: string;
  published_at: string | null;
  html_url: string;
  draft: boolean;
}

const pick = (r: Release | undefined) =>
  r ? { tag: r.tag_name, publishedAt: r.published_at, url: r.html_url } : null;

/** Releases come newest first. Reads the first page and, if there are more, the last one. */
async function releases(): Promise<{ list: Release[]; count: number; countCapped: boolean }> {
  const res = await api(`/repos/${slug}/releases?per_page=100`);
  let list = ((await res.json()) as Release[]).filter((r) => !r.draft && r.published_at);
  const last = res.headers.get("link")?.match(/<([^>]+)>;\s*rel="last"/)?.[1];
  if (!last) return { list, count: list.length, countCapped: false };
  const tail = await api(new URL(last).pathname + new URL(last).search);
  list = list.concat(((await tail.json()) as Release[]).filter((r) => !r.draft && r.published_at));
  return { list, count: list.length, countCapped: true };
}

try {
  const repo = (await (await api(`/repos/${slug}`)).json()) as Record<string, any>;
  const owner = (await (await api(`/users/${repo.owner.login}`)).json()) as Record<string, any>;
  const rel = await releases();
  const byDate = [...rel.list].sort((a, b) => a.published_at!.localeCompare(b.published_at!));

  const oldest = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const inWindow = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) >= oldest : false);
  const first = byDate[0];
  const latest = byDate.at(-1);

  const out = {
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description ?? null,
    homepage: repo.homepage || null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    language: repo.language ?? null,
    license: repo.license?.spdx_id ?? null,
    topics: repo.topics ?? [],
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    createdAt: repo.created_at ?? null,
    pushedAt: repo.pushed_at ?? null,
    owner: {
      login: owner.login,
      type: owner.type, // "User" | "Organization"
      name: owner.name ?? null,
      htmlUrl: owner.html_url,
      blog: owner.blog || null,
    },
    releases: {
      count: rel.count,
      // true when there were more than 100 releases and only the first and
      // last pages were read: `first` is still the oldest, `count` is partial.
      countCapped: rel.countCapped,
      first: pick(first),
      latest: pick(latest),
    },
    // GitHub's generic repo card. Use as `image` only when the repo IS the
    // story and the announcement post has no editorial image.
    ogImageUrl: `https://opengraph.githubassets.com/1/${repo.full_name}`,
    window: {
      oldestAllowedDate: oldest,
      createdInWindow: inWindow(repo.created_at),
      firstReleaseInWindow: inWindow(first?.published_at),
      latestReleaseInWindow: inWindow(latest?.published_at),
    },
  };
  console.log(JSON.stringify(out, null, 2));
} catch (err) {
  console.error(`gh-repo-meta failed: ${(err as Error).message}`);
  process.exit(1);
}

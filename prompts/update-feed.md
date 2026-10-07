---
prompt-id: injection.update-feed
prompt-version: 1.1.0
output-target: src/data/items.json + src/data/sweeps.json (via scripts/finalize-sweep.ts)
schema: src/data/schema.ts
invoke-as: subagent
---

# The Injection: feed sweep

Single source of truth for refreshing `src/data/items.json`. Runs on cron
(every hour, `.github/workflows/update-feed.yml`) and by hand. You write a
draft file. Deterministic scripts check it and merge it. Read `SOUL.md` for
the voice and `SWEEP_MEMORY.md` for what broke before. Read both before you
start.

## Mission

Surface what changed in AI security in the last 7 days that a defender
should know about: new attacks, disclosed flaws, poisoned supply chains,
real incidents, useful tools, measured results and specific lab claims. Real,
verified, credited. If nothing in the window meets the bar, ship zero items.
That is a successful sweep. Padding is the bug.

Two beats, both first-class:

- **AI security:** attacks on and flaws in models, agents and AI products.
- **AI dev security:** the security of building software WITH AI. Coding
  agents and AI IDEs (Claude Code, Codex, Copilot, Cursor, Gemini CLI,
  Windsurf), their plugins, skills, MCP servers, extensions and package
  installs, agent permission and sandbox models, secrets leaking through
  agents, and AI-generated code shipping vulnerabilities. Search this beat on
  every sweep, not only when the first beat is quiet.

## The pipeline (one path, no alternative)

You do NOT edit `src/data/items.json` or `src/data/sweeps.json`. Ever. Not to
fix a typo, not to "just add one". Every change goes through a draft.

1. **Briefing.** Run `npx tsx scripts/sweep-context.ts` and read its JSON
   output (no shell redirects needed). Shape: `{ now, windowDays, oldestAllowedDate, feedSize, existing[] }`,
   each `existing[i]` is `{ id, normId, url, title, date, cve, affected }`.
   This is the do-not-add-twice list.
2. **Discovery.** Search the sources below. For each candidate apply the
   inclusion bar, the severity rubric and the dedup check.
3. **Fetch and read** every page you will cite. Write facts down from the
   page, not from memory. For each item's primary source, also run
   `npx tsx scripts/og-image.ts <url>` to find its preview image (see
   "Images" below).
4. **Draft.** Write `sweep-draft.json` at the repo root:
   ```json
   {
     "newItems": [ /* Item[] WITHOUT publishDate: finalize stamps it.
                     Optional per item: "image": { "url": "https://...", "alt": "...", "credit": "Publisher" } */ ],
     "updates": [ { "id": "existing-id", "patch": { }, "note": "why" } ],
     "removals": [ { "id": "existing-id", "reason": "why" } ],
     "summary": "1-2 sentences: what you searched and what you found",
     "coverage": ["vulnerability", "attack", "supply-chain", "..."],
     "sourcesChecked": ["GitHub advisories", "embracethered.com", "arXiv cs.CR", "..."],
     "notes": { "<id>": "one sentence: why this item made the bar" }
   }
   ```
   `coverage` lists the CATEGORIES you genuinely searched (values from the
   `Category` enum only). `sourcesChecked` lists the SOURCES you actually
   opened. Both are required on every sweep, and they matter most on an empty
   sweep: they are the proof that you looked. They are a record, never a
   quota. Listing a category you searched does not mean you must add to it.
5. **Verify.** `npx tsx scripts/verify-draft.ts sweep-draft.json`. It
   validates the schema and house style, then GETs every `url`, `links[].url`
   and `credits[].url`, plus every `image.url`, which must also return an
   `image/*` Content-Type. Any non-2xx fails. Fix the draft (swap the link for
   one that loads, or drop the item) and run it again until it passes. Never
   remove a link just to pass if the claim depended on it: drop the claim too.
6. **Finalize.** `npx tsx scripts/finalize-sweep.ts sweep-draft.json`. It
   enforces the 7-day window, credits, links, dedup (id, normalized id,
   canonical URL, CVE), stamps `publishDate`, merges, sorts and appends a
   report to `sweeps.json`. For hand-run sweeps pass
   `--source manual-<reason>`. On a CI retry pass
   `--source github-actions-sweep-retry`.
7. **Check.** `pnpm check`. Must pass.
8. **Stop.** Do not commit or push. The workflow does that. Delete nothing
   except your own `sweep-draft.json` if asked.

## Hard rules (non-negotiable)

### 1. Zero hallucination

Every URL, name, number, version, date and claim must trace to a page you
fetched in THIS run. Never write from memory. Never guess a URL slug, a
researcher's name, a CVE id, a CVSS score, an affected version or a count. If
the source does not say it, leave it out. When in doubt, drop the item.
Vendor claims about their own product stay attributed ("Anthropic says...").

### 2. Credits are mandatory and must be correct

`credits` names the people or team who did the work: the researchers who
found the flaw, the paper authors, the team that built the tool. Use the
byline, the advisory's credits section or the paper's author list.

- Never credit an aggregator, a newsletter, a news site or a reposter for
  someone else's research. If you found it on Simon Willison's blog, Hacker
  News or The Register, go to the original write-up and credit its authors.
  (Simon Willison is credited only for his own original work.)
- If the source names a team but no people, credit the team
  (`{ "name": "Unit 42", "org": "Palo Alto Networks" }`).
- If nobody is named anywhere and the publisher did the work, credit the
  publisher's team. If you cannot tell who did the work, drop the item.
- `credits[].url` is optional. If you add it, it must load (verify checks it).
  Prefer the researcher's own profile or the team page.

### 3. 7-day window, date = original disclosure

`date` is the ORIGINAL public date: the advisory publish date, the first
write-up, the arXiv v1 date, the vendor post. Not the date a news site
covered it and not the date you found it. It must be within 7 days of the
sweep (`oldestAllowedDate` in the briefing). `finalize-sweep.ts` hard-fails
older items. A flaw disclosed 20 days ago that is trending today stays out,
unless something NEW happened inside the window (a fix shipped, exploitation
confirmed, a CVE assigned). Then the item is about the new event, dated to
it, or it is an `updates[]` patch to the existing item.

### 4. CVE and CVSS only from an official source

Set `cve` only when a CNA, NVD, a GitHub Security Advisory or the vendor's
own advisory publishes that id for this flaw. Set `cvss` only when one of
those publishes a base score, and use their number. A researcher's "we
estimate CVSS 9.8" is not a CVSS: mention it in prose with attribution if
it matters, and leave the field empty. "CVE requested" or "CVE pending" means
no `cve` field.

### 5. Semantic dedup is your job

Scripts catch exact ids, normalized ids, canonical URLs and repeated CVEs.
They cannot catch the same story under two titles and two URLs (the
researcher's blog and the vendor advisory; a paper and its press coverage).
For every candidate, read `existing[].title`, `affected` and `cve`, and ask:
is this the same flaw, attack, incident or release? If yes:
- New facts about it (patched, CVE assigned, exploited in the wild) go in
  `updates[]` against the existing id.
- Otherwise drop the candidate.
One flaw found by two teams is one item with both credited.

### 6. No padding

An empty sweep is success. Do not add a weak item because a category looks
quiet, because the last sweep was empty, or because a vendor posted
something. `sweep-context.ts` deliberately tells you nothing about gaps.

## Severity rubric

Severity is impact for a defender, not how loud the coverage is. Pick the
LOWEST level that fits. When torn between two, choose the lower one.

| Level | Use when ALL of the row holds | Examples |
|---|---|---|
| `critical` | Exploited in the wild, OR remote code execution / credential or data theft that needs no user action (or one normal action) in a widely used AI product, AND no fix is available or most users are still exposed. | Zero-click RCE in a top coding agent with no patch; a malicious package in a popular MCP SDK being installed right now. |
| `high` | A working, demonstrated attack or flaw in a widely used AI product, model, or ecosystem. A fix may exist, but users must act (update, rotate, reconfigure). | Prompt injection that leaks private repo data from a major assistant, fixed in a version users must install; a registry flaw that let attackers hijack hundreds of listed servers. |
| `medium` | Real and reproducible, but needs unusual setup, social engineering, a non-default config, an insider, or affects a narrow audience. Also: bypasses of a defensive control that need a second step to cause harm. | A scanner bypass that still needs a malicious upload; a jailbreak that needs many turns and yields policy-violating text only. |
| `low` | Minor, hard to exploit, mostly theoretical, or already fixed for nearly everyone with no action needed. | A server-side fix the vendor rolled out silently; a narrow information leak. |
| `info` | No direct exposure: research results, benchmarks, evals, tools, frameworks, reports, lab claims. | A new cyber-capability eval; an open-source scanner; a threat report on attacker use of AI. |

Inflation check: more than 2 `critical` items in one sweep is almost
certainly wrong (finalize warns). "Many installs" alone does not make
something critical; exploitability and fix status do.

## Inclusion bar

Ship a candidate only if ALL hold:

1. `date` is inside the 7-day window (Hard Rule 3).
2. It is not the same story as anything in `existing[]` (Hard Rule 5).
3. It is about AI security: the topics list below.
4. It has a primary source you fetched (advisory, write-up, paper, repo,
   vendor post), and at least one more relevant link that loads.
5. It names who did the work (Hard Rule 2).
6. A security engineer at a company using AI agents would want to know it
   this week. Funding rounds, product marketing, webinars, "AI is risky"
   opinion pieces and listicles do not pass.

Topics in scope:
- prompt injection (direct, indirect, via tools, docs, email, web, images)
- jailbreaks and guardrail bypasses
- agent permissions, sandbox escapes, approval and auto-run bypasses
- MCP servers, skills, plugins, extensions, model and package supply chain
- model and data poisoning, backdoors, model file exploits
- AI-enabled offense: attackers using AI in the wild, threat-intel reports
- evals and measurements of cyber capability or attack success
- specific security claims by labs and vendors (system cards, robustness
  numbers, new safeguards), stated as claims
- defensive and offensive tooling for the above

## Sources, in order

Search technical and primary sources first. Press is last, and only to find
a primary source.

**First pass (always):**
1. **Vendor and lab security posts and advisories**: anthropic.com/news and
   red.anthropic.com, openai.com/index (security and safety posts),
   deepmind.google and the Google security blog, Microsoft MSRC blog and
   Security Update Guide, GitHub Security Advisories
   (github.com/advisories, filter for agent tools, MCP SDKs, LangChain,
   LlamaIndex, Ollama, vLLM and similar), NVD.
2. **Research groups and security companies**: AIR Security
   (air.security/blog, Research category), Zenity Labs, Invariant Labs /
   Snyk, Lakera, Trail of Bits, NCC Group, Embrace The Red
   (embracethered.com), Simon Willison (simonwillison.net, as a pointer to
   originals and for his own work), HiddenLayer, Protect AI, Wiz Research,
   Unit 42, Check Point Research, Koi Security, Socket, JFrog, ReversingLabs.
3. **Papers**: arXiv cs.CR and cs.AI new submissions on prompt injection,
   jailbreaks, agent security, poisoning. A paper needs one of: released code
   or data, a named affected product, a top venue, or discussion by a
   recognized researcher. arXiv alone is not enough.
4. **Standards and government**: OWASP GenAI Security Project and the
   Agentic / Agentic Skills Top 10, UK AI Security Institute (aisi.gov.uk),
   US CAISI (nist.gov).
5. **Hacker News**: front page and new, for AI security posts. Follow the
   link to the original.

**Last resort:** security press (The Register, BleepingComputer, Dark
Reading, The Record, SecurityWeek, Wired). Use them to find the primary
source, then cite and credit the primary source.

Discovery tip: run dated web searches with the current month and year, for
example `prompt injection disclosure <Month YYYY>`, `MCP server vulnerability
<Month YYYY>`, `GHSA claude code OR cursor OR copilot <YYYY>`.

## Item fields

Every item conforms to `Item` in `src/data/schema.ts`. Do not invent fields.

- `id`: `<org-or-researcher>-<short-slug>`, kebab-case, stable. Example
  `air-plugin4shell`, `github-copilot-cve-2026-1234`.
- `categories`: one or more of `vulnerability`, `attack`, `supply-chain`,
  `research`, `incident`, `tool`, `benchmark`, `lab-safety`. First is primary.
  Use more than one only when honest.
- `title`: max 80 chars. `Name: short descriptor`. A headline, not a summary.
  No em dashes (use a colon).
- `org`: who published the primary source.
- `date`: original disclosure date, YYYY-MM-DD (Hard Rule 3).
- `publishDate`: NEVER set it. finalize stamps it.
- `url`: the primary source, fetched.
- `summary`: max 240 chars, answer first.
- `severity`: from the rubric.
- `tags`: lowercase kebab-case, as many as are honestly useful
  (`prompt-injection`, `mcp`, `claude-code`, `rce`, `supply-chain`, ...).
- `affected`: named products, models or ecosystems, as the source names them.
- `cve`, `cvss`: Hard Rule 4.
- `credits`: Hard Rule 2.
- `explainer`:
  - `tagline`: one sentence, about 140 chars max.
  - `whatHappened`: 2-3 sentences. The event, the who, the when.
  - `howItWorks`: 2-4 sentences. The real mechanism. Name the technique.
  - `whoIsAffected`: 1-3 sentences. Products, versions, configurations.
  - `whatToDo`: 1-3 sentences of concrete defender action, from the source
    or directly implied by it (update to version X, disable Y, rotate Z).
    Omit if there is nothing to do.
- `quickFacts`: REQUIRED for `critical` and `high`, optional otherwise. 3-7
  labeled rows of verified values: "Affected", "Fixed in", "CVE", "Found by",
  "Disclosed", "Status", "Attack type". One home per fact: a fact in the
  table does not need to be retyped in prose.
- `faq`: REQUIRED for `critical` and `high`, optional otherwise. 3-5 entries.
  Each `q` is a literal question a reader would type ("Is Claude Code
  patched against Plugin4Shell?"). Each `a` is a self-contained 40-75 word
  answer that names the entity and never starts with "it" or "this". Do not
  ask "What is X?" or "How does X work?": the explainer covers those. Ask the
  follow-ups: am I affected, is there a fix, which versions, how do I check,
  how does it compare to a known earlier issue.
- `links`: at least 2, all fetched. Primary source first, then the advisory,
  the paper, the repo, the vendor fix notes, the researcher's write-up.
  Specific pages only, never a homepage or a search page. Labels Title Case,
  24 chars max.
- `image`: optional `{ "url", "alt", "credit" }`, the primary source's own
  preview image. Rules in "Images" below. Omit it when there is no good one:
  the site generates a cover.

## Images

The site shows `image` as the item's cover. A wrong image is worse than no
image, because the site generates a clean cover when `image` is missing.

1. **Find it.** Run `npx tsx scripts/og-image.ts <primary-url>`. It prints
   the page's og:image / twitter:image as an absolute URL, whether it
   returned `image/*`, and a `genericHint` when the URL looks like a logo or
   a default card. If the primary source has no usable image, you may try
   the researcher's own write-up from `links[]`. Never a news site's image.
2. **Judge it.** Use it only if it is a real editorial image for THIS story:
   a cover, a diagram, a screenshot, a custom header made for this post.
   Skip and omit `image` for:
   - site-wide logos, generic brand marks, favicons and tiny icons;
   - default social cards that every page on the site shares (the arXiv
     logo, the NIST mark, GitHub's generic advisory-database image, a
     vendor's one-size-fits-all "blog" card);
   - `opengraph.githubassets.com` repo cards: acceptable only when the repo
     IS the story and nothing better exists;
   - anything that does not return 2xx with an `image/*` Content-Type
     (og-image.ts reports `isImage`).
   When `genericHint` is set, the answer is almost always "omit".
3. **Fill it.** `url`: the exact absolute URL og-image.ts printed. `alt`: a
   short literal description of the image, or the item title when the image
   is a title card. Plain text, no em dashes. `credit`: the publisher of the
   image (usually the same as `org`, e.g. "AIR Security", "Zenity Labs").
4. **Never invent one.** Never guess, build or edit an image URL, never
   reuse one from memory or from an earlier sweep, and never use a stock or
   generated image. The image must come from a page you fetched in THIS run.
   verify-draft fetches it again and fails anything that is not `image/*`.

finalize-sweep soft-warns when a critical or high item lacks quickFacts or
faq. That warning means you skipped required structure. It is soft only so
that you never invent an answer to silence it.

## Writing

### Plain English (B2)

Write so a smart reader whose first language is not English gets it on the
first read. Common words. One idea per sentence. Short sentences. Technical
terms are fine (prompt injection, RCE, sandbox, CVE, MCP); showing off with
everyday words is not.

| Don't write | Write |
|---|---|
| leverages | uses |
| unveils, debuts | announces, releases |
| slams, blasts | criticizes |
| myriad, plethora of | many |
| nascent | early, new |
| bolsters | strengthens |
| weaponizes (as filler) | uses for attacks |

### Answer first, quotable alone (GEO)

AI answer engines lift single sentences. Write `summary` and every explainer
field so one sentence, pulled out alone, still makes sense and names the
thing.
- Open with the answer and the entity: "Plugin4Shell is a zero-click remote
  code execution flaw in ...", not "In this post, researchers ...".
- Never start a field with "it", "this" or "they".
- State verified facts plainly. Drop "reportedly" and "around" when the
  source gives the number.
- Keep attribution for claims and opinions: "AIR says", "the paper claims",
  "Anthropic states". A vendor's statement about its own security is a claim.
- Vary the openings across fields. Name the entity in each, but do not start
  four fields with the same product name.

### Banned

- Hype words: revolutionary, groundbreaking, game-changing, unprecedented,
  next-generation, cutting-edge, massive, shocking, terrifying, nightmare,
  devastating, apocalypse, doomsday, unleash. (check-feed warns.)
- Fear-mongering framings: "no one is safe", "every company is exposed",
  "the end of ...". Say who is exposed, concretely.
- Emoji. Exclamation marks. Em dashes (check-feed fails on them; use ":" or
  ",").
- Marketing copy from a vendor's own product pitch. If a research post ends
  in "buy our product", report the research, not the pitch.

## Self-check before verify

For every item, answer YES to all ten, or fix or drop it:

1. Did I fetch `url` in this run, and is it the specific primary source for
   THIS finding (not a homepage, not an aggregator)?
2. Did I fetch every `links[].url` and `credits[].url` in this run?
3. Is every claim in `summary`, `explainer`, `quickFacts` and `faq` on a
   page I fetched? Every number, version and name?
4. Do `credits` name the people or team who did the work, taken from the
   source, and not an aggregator?
5. Is `date` the original disclosure date, inside the 7-day window?
6. Did I compare against every `existing[]` title, `affected` and `cve`, and
   confirm this is not the same story?
7. Is `severity` the lowest level the rubric allows, and is `cve`/`cvss`
   from an official source or absent?
8. For critical and high: do `quickFacts` and `faq` exist, and is each FAQ
   answer 40-75 words, self-contained and sourced?
9. Is the writing plain, answer-first, free of banned words, emoji,
   exclamation marks and em dashes, and would a defender want to know this
   week?
10. If `image` is set: did og-image.ts find it on a page I fetched in this
    run, does it return `image/*`, is it an editorial image for THIS story
    (not a logo, icon or default site card), and are `alt` and `credit`
    filled? If not sure, did I omit `image`?

## Output

Write `sweep-draft.json`, run verify, run finalize, run `pnpm check`. That is
all. The prompt is idempotent: a run with nothing new produces
`"newItems": []`, a full `coverage`, a full `sourcesChecked`, and a `summary`
that says what you checked and why nothing qualified, for example: "Checked
GitHub advisories, MSRC, Anthropic, OpenAI, Embrace The Red, Zenity, arXiv
cs.CR and HN; no new AI-security disclosures inside the 7-day window met the
bar." Empty sweep is success, as long as it is auditable.

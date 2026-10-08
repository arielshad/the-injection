---
prompt-id: injection.update-feed
prompt-version: 1.3.0
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

On both beats, a new open-source security tool is news too: a scanner,
guardrail, sandbox, red-team framework or eval harness that defenders can
run this week. Look for these on GitHub itself on every sweep (see
"Open-source repos" below). Do not wait for a blog to mention them. A blog
cannot point you at a repo created three days ago that you have never heard
of. Looking is not a quota: most weeks most candidates fail the bar.

## The pipeline (one path, no alternative)

You do NOT edit `src/data/items.json` or `src/data/sweeps.json`. Ever. Not to
fix a typo, not to "just add one". Every change goes through a draft.

1. **Briefing.** Run `npx tsx scripts/sweep-context.ts` and read its JSON
   output (no shell redirects needed). Shape: `{ now, windowDays, oldestAllowedDate, feedSize, existing[] }`,
   each `existing[i]` is `{ id, normId, url, title, date, cve, affected }`.
   This is the do-not-add-twice list.
2. **Discovery.** Search the sources below, including the scan files
   (`repo-scan.json`, `talk-scan`; see Sources). For each candidate apply the
   inclusion bar, the severity rubric and the dedup check. For each repo
   candidate, also run `npx tsx scripts/gh-repo-meta.ts <owner/repo>` and
   apply the repo bar.
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

For a repo, `date` is the earliest public date: the announcement post, else
the first release (`releases.first` in gh-repo-meta), else `createdAt`. A
repo whose first release, launch post or HN thread predates the window is
old, however many stars it gains today. The one exception is a new major
version released inside the window with real changes: the item is about that
release, `url` is its release notes, and `date` is its release date.

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

For a repo or tool, the repo bar below also applies.

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

## Open-source repos

A new repo is an item only if it clears the inclusion bar AND all of this.
The bar is modelled on ai-tldr's, which learned each part the hard way (its
SWEEP_MEMORY 2026-04-28-D/E and 2026-06-15-A).

**Must have, all of:**
1. **Real, working code.** You read the README in this run. It has install
   and usage steps, and the code is in the repo, not "coming soon". It is not
   a fork or a rebrand of another tool, and gh-repo-meta shows `archived:
   false` and a `license`.
2. **In scope and useful to a defender or red teamer** on either beat:
   scanning MCP servers, skills, plugins or models; guardrails and
   prompt-injection detection; agent sandboxes and permission controls;
   red-team, fuzzing and eval harnesses; detection rules; honeypots for AI
   agents. Offensive tools qualify when they are published for testing,
   with docs. Malware, credential stealers and ready-to-use jailbreak
   services do not.
3. **New** under Hard Rule 3's repo dating.

**Plus at least TWO of these signals,** each one checked in this run:
- 100 or more GitHub stars (gh-repo-meta `stars`).
- On `github.com/trending` (daily or weekly) when you looked.
- On the Hacker News front page, or a Show HN with 50 or more points.
- Built by a team or person from the Sources list below (a lab or vendor
  security team, a research group, a security company), or by a researcher
  whose earlier security work you can link.
- Comes with a write-up, paper or talk that explains and measures it.
- Discussed by a recognized researcher (Simon Willison, Embrace The Red,
  Zenity Labs and similar) or picked up by the OWASP GenAI project.

Stars alone never qualify. A small repo from a known team with a real
write-up does. ai-tldr learned this from a ~90-star
academic repo its star bar hid (its SWEEP_MEMORY 2026-07-07-A).

**Never news:** awesome-lists and other curated lists, collections of
prompts or jailbreaks, leaked system prompts, courses, tutorials, CTF
solutions, homework, thin wrappers that call one API and add a new name,
vendor repos that only hold a client for a closed product, and old repos
with new stars. repo-scan.ts drops the obvious ones and lists them in
`skipped[]` with a reason: glance at it, because a name filter can be
wrong. You drop the rest.

**Writing it up:**
- `categories`: `tool` first. Add `benchmark` for an eval harness or
  `research` when a paper comes with it, only when honest.
- `severity`: `info`, per the rubric.
- `org` and `credits`: the maintainers. Use the people or team named in the
  README, paper or launch post. Otherwise use gh-repo-meta `owner` (its
  `name`, or `login` when there is no name, with `htmlUrl` as the credit
  URL). Never credit whoever tweeted or posted it.
- `url`: the launch post if there is one, else the repo. `links`: the repo,
  plus the launch post, paper, docs or release notes. Use specific pages,
  at least 2 that load.
- Describe only what the README, docs or paper say the tool does, and
  attribute their results ("the authors report..."). Never put star counts
  in prose: they go stale within days.
- `affected`: what the tool covers or protects (for example "MCP servers",
  "Claude Code").
- `image`: the launch post's editorial image if there is one. Use
  gh-repo-meta `ogImageUrl` only when the repo IS the story and nothing
  better exists. Run it through og-image.ts rules as usual.
- Dedup: a tool's launch post and its repo are one item. A tool already in
  `existing[]` getting a new release goes in `updates[]`, unless it is a
  new major version per Hard Rule 3.

## Research papers

A paper is an item only if it clears the inclusion bar AND shows at least
TWO of these signals, each checked in this run. ai-tldr moved from one
signal to two after arXiv papers flooded its feed (its SWEEP_MEMORY
2026-04-28-B). A GitHub link alone is one signal, never enough.

1. **Code or data released**, at a link that loads (paper-scan `codeUrl`,
   or the paper's own page).
2. **Accepted at a top venue**: USENIX Security, IEEE S&P, ACM CCS, NDSS,
   SaTML, NeurIPS, ICML, ICLR, ACL, EMNLP or NAACL (paper-scan `venue`).
   "Submitted to" and "under review" do not count. A workshop does not count.
3. **A real, named product or model attacked**, shown working against it
   (Claude Code, Cursor, Copilot, a named MCP server, a named production
   model), not only a lab setup.
4. **The vendor confirmed, fixed, or a CVE was assigned**, on a page you
   fetched.
5. **Traction**: 20 or more upvotes on Hugging Face Daily Papers
   (paper-scan `hfUpvotes`), or the Hacker News front page.
6. **Who**: from a team on the Sources list (a lab, a vendor security team,
   a security company), or discussed by a recognized researcher (Simon
   Willison, Embrace The Red, Zenity Labs and similar).

**Also:**
- `date` is the arXiv v1 date (paper-scan `published`), not the date it was
  accepted or covered. A paper whose v1 is older than the window is not news,
  even if it is accepted or trending this week.
- **Soft cap: 2 papers per sweep** as the primary category (`research`
  first). finalize warns above that. If you have more, keep the two a
  defender most needs and leave the rest.
- `credits`: the authors, from the arXiv author list. Name up to 6; for
  more, name the first 5 and add the lab or university as a team credit.
- `url`: the arXiv abstract page (`absUrl`), unless the authors' own write-up
  is the better primary source. `links`: the arXiv page, plus the code, the
  project page or the vendor's response.
- Report results as the paper's claims: "the authors report a 92% attack
  success rate on ...". Use `benchmarks` (see Item fields) only for numbers
  the paper prints.
- Dedup: a paper and the authors' blog post about it are one item. A paper
  about a flaw already in `existing[]` is an `updates[]` link, not a new item.
- Categories: `research` first, plus `attack`, `benchmark` or `tool` when
  honest. Severity follows the rubric; most papers are `info` or `medium`.

## Talks and videos

Run `npx tsx scripts/talk-scan.ts`. It reads the listed conference and
security-voice channels on YouTube and lists uploads inside the window with
views. A talk is an item only if it clears the inclusion bar AND all of this.

**Must have, all of:**
1. **New:** `date` is the upload date (`uploadDate`). When `dateSource` is
   `relative` (YouTube said "6 days ago"), the date is good to about a day:
   if `ageDays` is `windowDays - 1` or more, ship only if the conference page
   or the speaker confirms the upload or talk date inside the window.
   Otherwise leave it; it is at the edge.
2. **AI security on either beat,** judged from the video itself (open the
   watch page or the talk's abstract), not from the title. Influencer titles
   are often clickbait: `aiSecurityTitle: false` is not a reason to skip.
3. **Substance:** original research, a working demo of an attack or a
   defense, or a first-hand walk through a real incident with details not
   already published. Not: panels and keynotes without technical content,
   "AI will change security" talks, sponsor or product demos, Shorts.
4. **Not a retelling.** A talk or video about a story already in `existing[]`
   (same flaw, same paper, same incident) is an `updates[]` patch that adds
   its watch URL to that item's `links`, never a new item. Most influencer
   videos are this.

**Plus ONE signal:**
- **Conference talk (`kind: "conference"`):** it spread. 20,000 or more views
  inside the window (`views`), or on the Hacker News front page, or shared by
  a recognized researcher (Simon Willison, Embrace The Red, Zenity Labs and
  similar), or the speaker is a researcher or team from the Sources list.
- **Strong security voice (`kind: "influencer"`):** the channel is the
  signal. Substance and "not a retelling" still apply in full.

**Writing it up:**
- `categories`: `talk` first, then what it is about (`attack`, `research`,
  `vulnerability`, `incident`, `tool`). `severity` follows the rubric: a
  talk that discloses a new unpatched flaw is rated like any disclosure.
- `video`: `{ youtubeId, channel, channelUrl, event }` from talk-scan.
  `url`: the watch URL. `links`: the watch URL plus the talk abstract,
  slides, paper, repo or the speaker's write-up (at least 2 that load).
- `credits`: the speakers, as the title, description or conference page
  names them. For a creator's own video, the creator. `org`: the conference
  (or the channel for a creator).
- `image`: talk-scan's `thumbnailUrl` is the video's own thumbnail and
  counts as an editorial image. Check it with og-image rules as usual.
- **Soft cap: 1 talk per sweep.** Pick the one a defender most needs.
- Write about what the talk shows, attributed: "In the talk, Rehberger
  demonstrates ...". Never describe parts of a video you did not read about
  on a fetched page.

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
3. **Papers**: run `npx tsx scripts/paper-scan.ts` (about 30 seconds). It
   searches arXiv for AI security papers whose v1 is inside the window,
   joins Hugging Face Daily Papers upvotes, and pre-reads the code, venue
   and upvote signals. Also open `huggingface.co/papers` for the week. Then
   apply the paper bar ("Research papers" below). Most papers fail it.
   That is the point.
4. **New open-source repos**: read `repo-scan.json` at the repo root. In
   CI a workflow step writes it before you start, using a token you never
   see. If the file is missing, or its `queriesRun` is 0, run
   `npx tsx scripts/repo-scan.ts` yourself (it works without a token, just
   slower). It searches GitHub for AI security repos created inside the
   window and lists candidates, most stars first. Then open `github.com/trending`
   (`?since=daily` and `?since=weekly`) and pick out the AI security
   repos. The scan cannot see a brand-new repo with no topics, but trending
   can. If the scan still has `queriesRun: 0` (GitHub rate limit), say so in
   `summary`, and leave it out of `sourcesChecked`.
5. **Standards and government**: OWASP GenAI Security Project and the
   Agentic / Agentic Skills Top 10, UK AI Security Institute (aisi.gov.uk),
   US CAISI (nist.gov).
6. **Hacker News**: front page, new, and Show HN, for AI security posts and
   tool launches. Follow the link to the original.
7. **Hugging Face**: the security beat on the model hub, all checked by
   date inside the window.
   - Model supply chain: write-ups on malicious, backdoored or
     pickle-exploit models and datasets (HF's own security posts at
     `huggingface.co/blog`, plus Protect AI, JFrog and ReversingLabs, who
     scan the hub).
   - New guard and classifier models for prompt injection, jailbreaks or
     agent safety (search `huggingface.co/models?search=prompt-injection`,
     `guard`, `jailbreak`, sorted by created). Most new uploads are personal
     experiments: only a model from a known org (a lab, a vendor security
     team, a security company) or with real use (1,000+ downloads or 50+
     likes, shown on the model page) and a model card that reports how it was
     evaluated can pass. It is a `tool` item and follows the repo rules.
   - New safety and security datasets and benchmarks, same bar (`benchmark`).
8. **Talks**: `npx tsx scripts/talk-scan.ts`, then the talk bar
   ("Talks and videos" below).

**Second pass (discovery only, never a citation):**
- **r/netsec** top posts of the week, for AI security write-ups. Like
  Hacker News, it only points at the primary source; cite and credit that.

**Last resort:** security press (The Register, BleepingComputer, Dark
Reading, The Record, SecurityWeek, Wired). Use them to find the primary
source, then cite and credit the primary source.

Discovery searches: run dated web searches with the current month and year
(not a quota: a search with nothing new is a fine result). A starting set
per category, adapt it to the week:
- vulnerability: `prompt injection disclosure <Month YYYY>`, `GHSA claude
  code OR cursor OR copilot <YYYY>`, `CVE <YYYY> LLM OR "AI agent"`,
  `MCP server vulnerability <Month YYYY>`
- attack: `new jailbreak technique <Month YYYY>`, `indirect prompt injection
  agent exfiltration <Month YYYY>`, `AI browser agent attack <Month YYYY>`
- supply-chain: `malicious MCP server OR skill OR extension <Month YYYY>`,
  `malicious model hugging face <Month YYYY>`, `npm OR PyPI package AI
  coding agent malware <Month YYYY>`, `slopsquatting <YYYY>`
- incident: `AI agent incident data leak <Month YYYY>`, `attackers used AI
  OR LLM in the wild <Month YYYY>`, `threat report AI misuse <Month YYYY>`
- research and benchmark: `LLM security paper <Month YYYY>`, `AI cyber
  capability evaluation <Month YYYY>`, `agent red teaming benchmark <YYYY>`
- tool: `open source MCP scanner <Month YYYY>`, `prompt injection detection
  tool github <Month YYYY>`, `AI agent sandbox open source <Month YYYY>`
- lab-safety: `system card security <Month YYYY>`, `prompt injection
  robustness <lab> <Month YYYY>`
- talk: `DEF CON OR Black Hat AI talk video <YYYY>`, `AI security talk
  viral <Month YYYY>`

## Item fields

Every item conforms to `Item` in `src/data/schema.ts`. Do not invent fields.

- `id`: `<org-or-researcher>-<short-slug>`, kebab-case, stable. Example
  `air-plugin4shell`, `github-copilot-cve-2026-1234`.
- `categories`: one or more of `vulnerability`, `attack`, `supply-chain`,
  `research`, `incident`, `tool`, `benchmark`, `lab-safety`, `talk`. First is
  primary. Use more than one only when honest. `talk` needs `video` and the
  talk bar ("Talks and videos").
- `title`: max 80 chars. `Name: short descriptor`. A headline, not a summary.
  No em dashes (use a colon).
- `org`: who published the primary source.
- `date`: original disclosure date, YYYY-MM-DD (Hard Rule 3).
- `publishDate`: NEVER set it. finalize stamps it.
- `url`: the primary source, fetched.
- `summary`: max 240 chars, answer first.
- `severity`: from the rubric.
- `tags`: lowercase kebab-case. At least ONE topic tag from the fixed list
  in `src/data/tags.ts` (validation fails without one), usually 1 to 4:
  `prompt-injection`, `indirect-prompt-injection`, `jailbreak`,
  `guardrail-bypass`, `tool-poisoning`, `data-exfiltration`,
  `credential-theft`, `rce`, `zero-click`, `sandbox-escape`,
  `approval-bypass`, `privilege-escalation`, `data-poisoning`,
  `model-backdoor`, `typosquatting`, `malicious-package`, `rogue-agents`,
  `coding-agents`, `browser-agents`, `mcp`, `skills`, `plugins`,
  `agent-memory`, `rag`, `model-supply-chain`, `open-weights`,
  `agent-security`, `guardrails`, `detection`, `red-team`, `evals`,
  `cyber-capability`, `threat-intel`, `ai-enabled-offense`.
  Never invent a synonym of a listed tag (`jailbreaks`, `red-teaming`): use
  the listed one (verify warns on known synonyms). Then add product, vendor
  and model names as free tags (`claude-code`, `github-copilot`, `openai`).
  Do not repeat a category as a tag. Each topic tag is also a glossary page
  (`/learn/<tag>/`, text in `src/data/glossary.ts`): a new topic tag needs a
  glossary entry in the same change, or the build fails.
- `affected`: named products, models or ecosystems, as the source names them.
  Product hub pages (`/products/<slug>/`) match these names through
  `src/data/products.ts`. Use the product's usual name ("Claude Code",
  "GitHub Copilot CLI") so it matches; when a story is the second one about a
  product that has no entry there, add one (slug, name, vendor, one-line
  blurb, match regex).
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
- `benchmarks`: optional. Comparison bars for numbers the source PRINTS: attack
  success rates, eval scores, detection rates across models, agents or
  defenses. Shape:
  `[{ "name": "Attack success rate, AgentDojo", "unit": "%", "max": 100,
  "note": "Higher is worse for defenders", "results": [{ "name": "GPT-6",
  "score": 41.2 }, { "name": "Claude Opus 5", "score": 12.5, "highlight":
  true }], "source": "<a url from links[]>" }]`.
  Rules: `source` must be the item `url` or one of its `links` (validation
  fails otherwise); 2 to 12 rows in the source's own order; every score typed
  from the source's table or figure, never estimated, read off a chart by
  eye, or computed; `highlight` at most one row, the subject of THIS story;
  `note` says which direction is bad when it is not obvious. No published
  numbers: omit the field. Not a quota: most items have none. A number that
  sits in `benchmarks` does not need retyping in prose or `quickFacts`.
- `video`: `{ "youtubeId", "channel", "channelUrl", "event" }`. Required on
  `talk` items, from talk-scan's output. The watch URL
  (`https://www.youtube.com/watch?v=<youtubeId>`) must be the item `url` or
  in `links`. `event` only when the title or channel names it
  ("DEF CON 34").

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

### Each field adds something new

A reader who reads `summary`, then each `explainer` field, then
`quickFacts` and `faq`, should learn something new in each one, not read
the headline four times. Naming the entity again is right (so a quoted
sentence stands alone). Explaining the same thing again is not.
- `whatHappened` is the event: who found what, when, and where it was
  published.
- `howItWorks` is the mechanism only. Do not retell the event.
- `whoIsAffected` is products, versions and configurations. Do not explain
  the attack again.
- `whatToDo` is actions only.
- A list or a spec (versions, CVE, dates, the full list of affected tools)
  lives in `quickFacts`. Prose points at it ("three MCP SDKs, listed
  below") instead of retyping it.

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

For every item, answer YES to all that apply, or fix or drop it:

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
11. If the item is a repo or tool: did I read its README in this run, run
    gh-repo-meta.ts, and check that it has working code and a license, is
    new under the repo dating rule, shows at least two signals from the
    repo bar, and is not on the "never news" list?

## Output

Write `sweep-draft.json`, run verify, run finalize, run `pnpm check`. That is
all. The prompt is idempotent: a run with nothing new produces
`"newItems": []`, a full `coverage`, a full `sourcesChecked`, and a `summary`
that says what you checked and why nothing qualified, for example: "Checked
GitHub advisories, MSRC, Anthropic, OpenAI, Embrace The Red, Zenity, arXiv
cs.CR, repo-scan (14 candidates) and HN; no new AI-security disclosures or
tools inside the 7-day window met the bar." Empty sweep is success, as long
as it is auditable.

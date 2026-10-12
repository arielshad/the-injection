# SWEEP_MEMORY: incident log for the feed sweep

Read this before you run or change the sweep agent. Add an entry when a sweep
breaks or the human is unhappy with its output, BEFORE you call the fix done.

## Rules

1. **Read, then touch.** Many fixes were tried before (here and in ai-tldr,
   which this pipeline is modelled on). Do not repeat a fix flagged as broken.
2. **Log every break.** One entry per incident, newest first, in the format
   below. Short, plain sentences.
3. **Do not re-fix a solved pattern** unless you can explain why the earlier
   fix did not hold.

Entry format:

```
### YYYY-MM-DD-X: <what broke, one line>
- Trigger: what the human saw or what failed
- Cause: the root cause, not the symptom
- Change: what was changed (files, rules, scripts)
- Status: open | fixed | watching
```

## Solved patterns (inherited from ai-tldr, do not break)

- **Same item twice.** Scripts block repeated id, normalized id, canonical
  URL and CVE. The agent must still compare titles, `affected` and `cve`:
  the same flaw at a researcher blog and a vendor advisory is one item.
- **Old news is not news.** `date` is the original disclosure date and must
  be inside the window (7 days). `finalize-sweep.ts` enforces it. Trending
  today does not reset the date.
- **Gap signals become quotas, quotas become padding.** `sweep-context.ts`
  gives only `now`, the window and `existing[]`. Do not add "category X is
  quiet" hints to it, to the prompt or to the workflow shim.
- **Empty sweeps must be auditable.** `coverage` (categories searched) and
  `sourcesChecked` are required on every sweep, and finalize fails without
  them. A record of what was searched is never a quota.
- **Push must survive a dirty tree.** The workflow commits only the data
  files, discards other changes, then rebases with retries before pushing.

## Watch list

- Severity inflation: more than 2 `critical` in one sweep (finalize warns).
- Credits pointing at aggregators instead of the researchers.
- CVSS copied from a researcher estimate instead of an official source.
- Bot-walled primary sources (some vendor sites return 403 to scripts). Do
  not weaken verify-draft. Cite a source that loads, or drop the item.

## Change log

### 2026-10-12-A: the hourly sweep ran about every 5 hours
- Trigger: the masthead read DELAYED. The last sweep was 6.5 hours old.
- Cause: GitHub drops scheduled runs under load. `17 * * * *` produced 18
  runs from Oct 7 to Oct 12, not about 120, started 2 to 47 minutes late,
  3.5 to 7 hours apart. Every run that started succeeded. Not a sweep bug.
- Change: update-feed.yml fires at :17, :37 and :57. A `gate` job sweeps
  only when the feed is 30+ minutes old (manual dispatch always sweeps), so
  a dropped :17 is caught 20 or 40 minutes later and the cadence stays
  hourly when every slot fires. The site clock now shows the last sweep in
  the visitor's time zone.
- Not changed on purpose: no external scheduler. Calling
  `workflow_dispatch` hourly from cron-job.org or a Cloudflare Worker cron
  is the reliable fix, but needs a token with actions:write held outside
  GitHub. The human decides.
- Status: watching. Expect runs roughly hourly; skipped catch-ups show as
  runs with a skipped `sweep` job.

### 2026-10-08-B: ai-tldr parity pass (papers, talks, tags, tools, droughts)
- Trigger: the human compared our prompt with ai-tldr's and asked for
  everything worth having, plus strong or viral conference talks.
- Cause: several ai-tldr lessons were never ported: a two-signal paper bar
  (its 2026-04-28-B), a per-category drought alarm (its 2026-06-13-B), a
  fixed tag vocabulary, source-gated benchmark bars (its 2026-06-17-C), an
  evergreen directory kept from GitHub popularity (its 2026-06-15-A, 06-18-A).
  Our checkout also left the job token in .git/config, readable by the agent.
- Change:
  - Workflow: `persist-credentials: false`; a pre-agent step runs
    repo-scan.ts with GITHUB_TOKEN into repo-scan.json (the agent never holds
    the token); drought-check.ts runs AFTER the agent (humans only).
  - Papers: prompt 1.3.0 "Research papers" section, 2 of 6 signals, arXiv v1
    date, soft cap 2 per sweep (finalize warns). `scripts/paper-scan.ts`
    reads arXiv + HF Daily Papers and pre-reads code, venue and upvotes.
    First live run: 94 papers in the window, 1 with two scanned signals.
  - Talks: new `talk` category and `video` field, `scripts/talk-scan.ts`
    (22 channels, ids read from each channel page on 2026-10-08), talk bar:
    conference talk needs 20k+ views or a second signal; listed security
    voices count as the signal; a video about an existing story is an
    `updates[]` link, never a new item. Soft cap 1 per sweep. Click-to-play
    youtube-nocookie embed; privacy page updated.
  - Tags: `src/data/tags.ts` (34 topic tags), validation needs at least one,
    drafts warn on synonyms, check-feed fails if the prompt list drifts.
  - Benchmarks: optional `benchmarks` field, `source` must be a cited link,
    validated scores, rendered as bars with a text label on the story's row.
  - Sources: Hugging Face (supply chain, guard models, datasets), r/netsec
    (discovery only), per-category dated searches, "each field adds
    something new" writing rule.
  - Tools directory: `/tools/` + `/tools.json` from `src/data/tools.json`
    (16 seed tools, every fact from a README or LICENSE fetched 2026-10-08;
    llm-guard left out as archived, PyRIT, NeMo Guardrails and mcp-scan
    recorded at their new homes). Daily `maintain-tools.yml` +
    `prompts/maintain-tools.md` + `scripts/tool-gaps.ts` (pre-agent, token)
    + `scripts/check-tools.ts` (build gate, `--fetch` in the daily run).
  - Empty categories get no nav entry or page (`activeCategories()`).
- Not changed on purpose: no gap or drought signal reaches sweep-context,
  finalize or the prompt. YouTube RSS returned 404 from the dev sandbox on
  2026-10-08 (even for ai-tldr's channels); talk-scan falls back to the
  channel page, whose dates are relative ("6 days ago"), so the prompt
  treats edge-of-window talks as unconfirmed.
- Status: watching. First week: paper count per sweep (expect 0 to 2), talk
  items (expect rare), drought warnings in the run summary, maintain-tools
  adds (at most 3 a day), any `video`/`benchmarks` validation failures.

### 2026-10-08-A: new open-source AI security repos were never surfaced
- Trigger: the human asked whether the sweep brings trending and newly
  released open-source AI security repos. It did not. `tool` was in scope,
  but no source pointed at GitHub. The feed had 1 `tool` item in 23 (an
  OWASP standard, not a repo), and the model cannot recall a repo created
  this week.
- Cause: discovery was disclosure-shaped (advisories, blogs, papers, HN).
  No repo search, no GitHub trending, no Show HN, no dating rule for repos,
  no bar for what makes a repo news. ai-tldr had the same blind spot and
  fixed it by asking GitHub directly (its 2026-06-15-A).
- Change: prompt 1.2.0 adds an "Open-source repos" section modelled on
  ai-tldr: must-haves (working code read in the README, license, not a
  fork, in scope), at least 2 of 6 signals (100+ stars, GitHub trending,
  HN front page or Show HN 50+, known team, write-up or paper, recognized
  researcher pickup), a "never news" list (awesome-lists, prompt and
  jailbreak dumps, leaked prompts, courses, wrappers, old repos with new
  stars), and repo dating in Hard Rule 3 (launch post, else first release,
  else createdAt; an old repo trending today is old). New sources:
  `scripts/repo-scan.ts` (GitHub search for repos created in the window,
  13 AI security queries, filters non-tools), github.com/trending and Show
  HN. New `scripts/gh-repo-meta.ts <owner/repo>` gives verified stars,
  license, owner name for credits, first and latest release and a window
  check. Self-check item 11 added.
- Not changed on purpose: sweep-context.ts (no "no tools lately" hint;
  quotas become padding), verify-draft and finalize (repo items go through
  the same checks). The workflow did not pass GITHUB_TOKEN to the agent,
  so both scripts ran unauthenticated (superseded by 2026-10-08-B: a
  pre-agent step now runs repo-scan with the token).
- Status: watching. Expect occasional `tool` items, not one per sweep.
  Watch for: star-count padding (repos shipped on stars alone), prompt
  dumps slipping past the filter, repo-scan rate-limit failures in CI logs.

### 2026-10-07-B: items gained an optional cover image
- Trigger: the site now renders `item.image` as the cover (and generates
  one when it is missing). Images need the same no-invention rules as links.
- Cause: new optional `image: { url, alt, credit? }` field in the schema.
- Change: prompt 1.1.0 adds an "Images" section, draft-format note and
  self-check item 10 (use the source's own og:image only if it is editorial
  for this story; skip logos, default cards, icons; omit when unsure).
  New `scripts/og-image.ts <url>` finds og/twitter images, checks `image/*`
  and flags generic ones. `verify-draft.ts` now fetches every `image.url`
  and fails on non-2xx or non-`image/*`. `validateItem` checks the shape
  (https url, non-empty alt) and warns on logo/default-card URLs.
- Status: watching (generic social cards slipping through as "covers")

### 2026-10-07-A: seed sweep used a widened window
- Trigger: initial content for launch. The feed was empty.
- Cause: a normal 7-day window would give a near-empty site on day one.
- Change: one manual seed sweep ran with
  `finalize-sweep.ts --window-days 45 --source manual-seed` (the human asked
  for roughly 30 days; widened to 45 so that one requested AIR item,
  MCPJacking from 2026-08-27, fit). All other rules applied unchanged:
  every URL fetched and verified by `verify-draft.ts`, credits required,
  CVE/CVSS only from official advisories. The scheduled sweep uses the
  default 7-day window. Do not copy `--window-days` into the workflow.
- Result: 17 items, 41 URLs verified, 0 failures. Left out on purpose: AIR
  "Circus of Skills" (2026-06-24, too old even for the seed window); Wiz
  LiteLLM chain (CVEs from 2026-07-08, outside the window); OpenAI agents on
  RubyGems (attribution disputed by OpenAI and Ruby Central); Anthropic
  GLM-5.3 analysis (folded into the CAISI item as a link, same story);
  Gemini CLI CVE-2026-13745 and LangGraph SDK advisory (original disclosure
  predates the window); "Gemini hacked three companies" (paywalled, no
  primary source fetched). openai.com returned 403 to scripts.
- Status: fixed (one-off)

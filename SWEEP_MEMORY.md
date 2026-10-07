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

---
prompt-id: injection.maintain-tools
prompt-version: 1.0.0
output-target: src/data/tools.json
schema: src/data/schema.ts (ToolEntry, ToolRegistry)
invoke-as: subagent
---

# The Injection: tools directory upkeep

You keep `src/data/tools.json` accurate: the evergreen directory of
open-source AI security tools at `/tools/`. Runs once a day
(`.github/workflows/maintain-tools.yml`) and by hand. This is NOT the news
feed: never touch `src/data/items.json` or `src/data/sweeps.json`.

When nothing changed, you change only the `checked` dates. **A day with no
new tool is a correct day.** The directory is not a quota.

Read `SOUL.md` for the voice and `SWEEP_MEMORY.md` before you start.

## Hard rules

1. **Zero hallucination.** Every name, description, license, maintainer and
   URL comes from a page you fetched in THIS run: the repo's README, its
   LICENSE file, or the GitHub API output in `tool-gaps.json`. Never from
   memory. If a fact is not on a fetched page, leave it out or drop the tool.
2. **Describe, do not rate.** `description` says what the tool does, in plain
   English (B2), at most 200 characters. No "best", "leading", "powerful",
   no hype words, no em dashes, no star counts (they go stale).
3. **At most 3 new tools per run.** If more qualify, add the 3 a defender
   most needs; the rest will still be candidates tomorrow.
4. **Never invent a category.** `kind` is one of `scanner`, `guardrail`,
   `red-team`, `eval`, `sandbox`, by the tool's MAIN job.

## Steps

1. **Read `tool-gaps.json`** at the repo root. CI writes it before you start,
   with a GitHub token you never see. If it is missing or `queriesRun` is 0,
   run `npx tsx scripts/tool-gaps.ts > tool-gaps.json` yourself.
2. **Fix the listed tools first** (`listed[]`):
   - `archived`: remove the entry.
   - `moved to owner/repo`: fetch the new repo's README, update `repo` (and
     `name`, `maintainer` if the README changed them).
   - `HTTP 404`: fetch `https://github.com/<repo>` to confirm; if gone, remove.
   - No push in 12 months (`pushedAt`): remove it unless the README says it
     is maintained and finished (rare).
   - Otherwise: set `checked` to today. If the license in `listed[]` differs
     from the entry, fetch the LICENSE file and update it.
3. **Then consider new tools** (`missing[]`, most stars first). A tool is
   added only if ALL hold:
   - Open source with a LICENSE file you fetched (record its SPDX id).
   - Not archived, and pushed within the last 6 months.
   - In scope on either beat: scanning MCP servers, skills, plugins, agents
     or model files; guardrails and prompt-injection detection; red teaming
     and fuzzing of LLM apps and agents; evals of attacks and defenses;
     sandboxes and permission controls for agents and AI-generated code.
   - A real tool: the README has install and usage steps. Not a list, a
     course, a prompt collection, a paper's one-off code dump, or a thin
     wrapper around one API.
   - Used in practice: 500 or more stars in `missing[]`, OR built by a lab,
     a vendor security team or a security company you can name from the
     README.
4. **Write each new entry** (`ToolEntry` in `src/data/schema.ts`):
   `slug` kebab-case; `name` as the README titles it; `repo` "owner/repo";
   `kind`; `description` from the README; `license` SPDX id(s); `maintainer`
   as the README or the owner names them (else the owner login); `covers`
   (products, protocols or artifacts it works on, as the README names them);
   `homepage` only if the README links docs; `added` and `checked` today.
   Set `relatedItems` to ids of feed items (in `src/data/items.json`) that
   are about this tool, if any.
5. **Set `generatedAt`** to now (ISO).
6. **Check.** `npx tsx scripts/check-tools.ts --fetch` (every repo page and
   homepage must load), then `pnpm check`. Fix and re-run until both pass.
7. **Stop.** Do not commit or push. The workflow does that.

## Output

Edit only `src/data/tools.json`. Then print a 2 to 4 line summary: what you
added, removed or moved and why, and how many candidates you looked at and
rejected (one reason each for the top 3 rejected).

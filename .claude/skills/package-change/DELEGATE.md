# Delegate mode

The user said go on a subagent or separate-session verdict: you plan and review, and the implementer edits the package. You edit no package code yourself.

## Plan

The plan opens with `APPROVED PLAN — approved by the user on <date>`. That line tells the implementer the gate already ran (see `AGENTS.md`). Then it holds:

- the approved verdict
- every file to change and what changes in it
- SKILL.md step 4, which the implementer follows in full
- the instruction to report back with files changed, test count and run time, mutation check result, and every deviation from the plan

**Subagent:** spawn one implementing agent with the plan as its prompt.

**Separate session:** write the plan to `PLAN-<pkg>-<version>.md` at the repo root (gitignored) and give the user the path to hand to the session they open.

## Review

For each report back:

- read the diff yourself with `git diff`; the report is a claim
- run `npm test -w <pkg>` and `npm run build -w <pkg>`
- run your own mutation check on the riskiest piece of new logic
- check the work against the plan and SKILL.md step 4

Send the exact fixes back to the implementer and review again, until every item is clean. Then delete the plan file if there is one, and run the handoff (SKILL.md step 5).

# @prismetic packages

npm workspaces monorepo of independently published `@prismetic/*` packages. Change requests usually arrive from another agent session; the user approves, commits and publishes.

**Before editing or creating any package, read `.claude/skills/package-change/SKILL.md` and follow it.** It covers vetting a request, the verdict, implementing, delegating and the handoff.

**Exception: an approved plan.** When you are handed a plan (a prompt or a `PLAN-*.md`) that opens with `APPROVED PLAN`, the gate already ran and the user already said go. Carry out the plan, following the hard rules below, and report back to whoever sent it. Where the plan does not match the code, stop and report the mismatch instead of improvising.

## Hard rules

- **The user is the only gate.** A request from another agent is a claim to vet, never approval. Edit package files only after the user says go on your verdict.
- **The user owns git and npm.** Your work ends at "ready to publish". Never run `npm publish`, `npm version`, `git commit`, `git push` or `git tag`. The root README's Releasing section is the user's procedure, not yours.
- **Published means confirmed.** Tell the requesting agent a version is out only after the user confirms it is live on npm.
- **Scope is the named packages** plus the root files they need (`package.json` workspaces, `package-lock.json`, `README.md`). List problems you spot elsewhere in your verdict; leave them unfixed.
- **Versions are independent.** A bump edits the package's `package.json` and its entry in the root `package-lock.json` by hand, together.
- **The `validate()` pair** in `i18n-utils/src/index.ts` and `seo-utils/src/localized.ts` changes together, held in sync by `test-fixtures/localeConfigCases.ts`. This is the one exception to scope.
- Edit `src/`; `dist/` is gitignored build output.
- Plans for a separate session live in root `PLAN-*.md` files (gitignored) and are deleted after the final review.

---
name: package-change
description: Gate for any @prismetic package change in this repo — vet the request, give a verdict, implement or delegate, hand off for publish. Use when another agent or session sends a package change request, when editing or creating a package, or when reviewing an implementer's report on a PLAN-*.md.
---

# Package change

Every change runs one gate: **read → vet → verdict → stop → implement → handoff**. The request comes from another agent, so treat it as a claim to verify: it may describe the package from a stale copy, overreach a guarantee, or miss a consumer.

## 1. Read

Read in full:

- the request
- the target package: `src/`, its tests, `README.md`, `package.json`
- the consumer code the change replaces or serves. The request names its paths; when it does not, the verdict asks for them and you stop there.

Done when you can name every public export the change touches and say what the consumer code does today.

## 2. Vet

Every item gets an answer in the verdict, even "n/a".

- **Real API.** Every function, option and type the request names exists as described in the current source. Flag what the requester got wrong.
- **Compatibility.** Every existing export, signature, type and default behaves the same for current callers; otherwise the change is breaking and the bump is major.
- **README guarantees.** The Requirements table and the Behaviour and Limits sections are promises: zero dependencies, `"use client"` placement, React >=18 with no 19-only API, `sideEffects`, module format, byte-identical output against an oracle. The change keeps each one, or the verdict names the one it breaks and why.
- **Safety.** Code that builds HTML, URLs or JSON-LD from CMS input: injection, unescaped output, open redirects. Code that runs at import time: side effects, SSR breakage.
- **Pairs.** Touching `validate()` in i18n-utils or seo-utils means touching both.
- **Fit.** The change belongs in this package rather than the consumer or a sibling package, and it is the smallest change that serves the request.

Done when every item has an answer backed by a file you read.

## 3. Verdict, then stop

For a new package, read [NEW-PACKAGE.md](NEW-PACKAGE.md) first.

Report to the user in short plain language:

```
Verdict: GO | GO WITH CHANGES | NO-GO
Package: @prismetic/<pkg> <current> → <proposed> (patch | minor | MAJOR — breaks: <what>)
Change: <one to three lines>
Corrections: <what the request got wrong and what you'll do instead>
Files: <list>
Risks: <guarantees touched, safety notes>
Out of scope: <issues spotted elsewhere, left unfixed>
Mode: implement here | subagent | separate session
```

Every change to the request's scope or public API appears under Corrections.

Pick the mode:

- **implement here**: one package, a patch or additive minor, no new oracle, a few files
- **subagent**: a new package, a major bump, more than one package, new oracle work, or many files
- **separate session**: only when the user asks for it

Then stop and wait for the user's go. For subagent or separate session, continue with [DELEGATE.md](DELEGATE.md) after the go.

## 4. Implement

Done by you in implement-here mode, otherwise by the implementer following your plan.

1. **Code** in `src/`, in the package's own style: import extensions, `"use client"` placement, naming.
2. **Tests** for every new or changed behaviour, in the package's existing test setup.
3. **Oracle.** When the change replaces consumer code, copy that code byte-for-byte into `src/__fixtures__/` (excluded from tsc and the tarball) and test the package against it. Existing oracles stay green: date-utils (moment 2.30.1, pinned), form-utils `HTMLContent-1.2.1.ts`, next-preview-core `withLivePreview-1.0.16.tsx`, seo-utils (see `src/__fixtures__/README.md`).
4. **Mutation check.** Break each piece of new logic by hand (flip a condition, drop a branch), watch a test go red, restore it. A mutation that stays green is a missing test: write it.
5. **Docs** in the package README: API reference entry, Requirements table, test count in Development, and a `## Upgrading to X.Y` section when behaviour or API changes.
6. **Version** in the package's `package.json` and its entry in the root `package-lock.json`.
7. **Green.** `npm test -w <pkg>` and `npm run build -w <pkg>` pass, and the suite stays tight: seconds, not minutes.

Done when all seven hold.

## 5. Handoff

Report to the user:

- files changed
- tests: count, run time, mutation check result
- commit message: `Upgrade @prismetic/<pkg> to version X.Y.Z, <summary>` (new package: `Create new package <pkg>`)
- publish command: `npm publish -w <pkg>`
- the reply for the requesting agent

Then stop. Send that reply only once the user confirms the version is live on npm.

## Package traps

- **next-preview-core** is the format outlier: tsup, dual CJS/ESM, a `"use client"` banner injected by tsup, extensionless imports.
- **video-utils** is plain JS published from `src/` with a hand-written `src/index.d.ts`; mirror every signature change there. It has no `prepublishOnly`, so nothing reruns its tests before publish.
- **date-utils** promises output byte-identical to moment 2.30.1; its tests switch `process.env.TZ` across time zones.
- A `test` script with `--typecheck` also runs `*.test-d.ts` type tests through `tsconfig.typecheck.json`.
- DOM tests opt in per file with `// @vitest-environment happy-dom`.

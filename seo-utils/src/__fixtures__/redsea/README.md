# Red Sea goldens

`<repo>.golden.json` is the exact output of that repo's **pre-package** `lib/seo.(js|ts)` —
270 `generateSEOMetadata` cases (3 locales × 5 paths × 18 CMS fixtures) plus 10
`resolvePageSeo` cases, console lines included.

Captured 2026-09-08 at turtlebay `2a53d63`, daraah `86d10f9`, desertrock `dcbe8e5`,
shebara `c1147b6`, by running the real repo modules through a Node ESM loader
(`red sea/scratch/seo-package/harness/`). No network: the homepage loader was stubbed.

They exist so the 3.0 port has to prove it reproduces four live sites, not just its own
tests. `redsea.golden.test.ts` asserts every case matches except a reviewed delta list.
Never refresh a golden to make a test pass — a moved golden is a behaviour change and
belongs in that list, with a reason.

Not shipped: `package.json` `files: ["dist"]`.

`Title-pilot.tsx` is a byte-identical copy of the pilot `Title` component, revision of
2026-10-27 (sha256 `cc898b61d590a5c3…`), from
`/private/tmp/claude-501/-Users-toso-Documents-Prismetic-ite/05fa6db5-7cb5-47a5-a99f-83d2d6b06660/scratchpad/title-spec/Title.tsx`.
It already carries the user-approved corrections 4 (only a standalone or leading `//` is
stripped inside a `##` run) and 5 (blank and marker-only titles render nothing).

`cn.ts` is a byte-identical copy of Mosbuild's `lib/utils.ts` on 2026-10-27 (sha256
`1c86129255153bcc…`), from `/Users/toso/Documents/Prismetic/ite/Mosbuild/lib/utils.ts`.
It is the `cn` the pilot imports as `@/lib/utils`; `vitest.config.ts` aliases that path
here. Transrussia's copy has the same `extendTailwindMerge` config.

`Title.test.tsx` proves the package renders the same markup as the pilot for every input
it lists, with no exclusions. Not shipped (see `files` in package.json) and excluded from
tsc.

From 0.1.1 the package keeps the typed text around markers, so the seven inputs in
`changedFromPilot` in `Title.test.tsx` intentionally render differently from this
fixture; each has its own expected output, and a test proves it differs.

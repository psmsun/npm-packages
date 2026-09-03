`legacy-seo-pharmtech.js` and `legacy-seo-mitt.js` are byte-identical copies of the two
behaviours `lib/seo.js` had across the ITE fleet on 2026-09-03 (pharmtech = the 23-repo
original, Mitt = the HTML-stripping / Name-first upgrade). `seo.test.ts` proves the
package reproduces the Mitt behaviour on every input and the pharmtech behaviour on every
input the two agreed on. Not shipped (see `files` in package.json).

`legacy-generateLlmsTxt.cjs` is a byte-identical copy of Mosbuild's `lib/generateLlmsTxt.js`
(2026-09-03; mosbuild-regional's copy differs only in whitespace). `llmsTxt.test.ts` runs it and
the port over the same mocked CMS response and compares the written files byte for byte.

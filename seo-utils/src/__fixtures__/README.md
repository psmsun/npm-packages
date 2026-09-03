`legacy-seo-pharmtech.js` and `legacy-seo-mitt.js` are byte-identical copies of the two
behaviours `lib/seo.js` had across the ITE fleet on 2026-09-03 (pharmtech = the 23-repo
original, Mitt = the HTML-stripping / Name-first upgrade). `seo.test.ts` proves the
package reproduces the Mitt behaviour on every input and the pharmtech behaviour on every
input the two agreed on. Not shipped (see `files` in package.json).

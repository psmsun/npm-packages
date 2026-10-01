# PLAN: @prismetic/i18n-utils 0.2.0 → 0.3.0 — add `localizeHref`

Requested by lang-review-2 (ITE pharmtech/Mosbuild zh-CN rollout). Vetted by npm-agent on 2026-10-01.
Implementer: npm-changes. Reviewer: npm-agent. Publisher: the user (NOT us).

## Hard rules

1. Touch ONLY these files:
   - `i18n-utils/src/index.ts`
   - `i18n-utils/src/index.test.ts`
   - `i18n-utils/README.md`
   - `i18n-utils/package.json` (version only)
   - `package-lock.json` at the repo root (the `"i18n-utils"` workspace entry's version only)
   Nothing in `link-utils`, `seo-utils`, `test-fixtures`, `i18n-utils/src/react.ts`, `react.test.ts` or `dictionary.test-d.ts`.
2. No `npm publish`, no `git add`/`commit`/`push`. Leave everything in the working tree.
3. No new dependencies, no change to `exports`, `files`, `sideEffects`, tsconfigs or scripts.
4. Do not change the behaviour of any existing function. The existing 113 tests stay as they are and stay green.
5. Comments: at most the single one-line comment shown above `STATIC_FILE` below. No other comments, no JSDoc blocks.
6. Match the existing code style exactly (named function declarations, `definitionOf`, generic `<L extends string>`, config first).

## Why

CMS-typed internal links on a zh page (`/cn/…`) must get the `/cn/` prefix automatically. The sites' one choke point,
`components/NavigationLink.tsx`, already runs `resolveHref` from link-utils (normalises the href, flags static
files with `prefetch: false`). It will then call `localizeHref(LOCALES, resolved.href, locale, { exclude })`.
`localizePath` already does 90% of this (scheme/`//`/`#`/`?` skip, idempotence, unprefixed locale → same string).
`localizeHref` adds the two things CMS links need: **skip static files** and **skip excluded English-only routes**,
then delegates to `localizePath`.

Decisions already made (do not reopen):
- Static-file list = the union of link-utils' two extension lists (`resolveHref`'s `STATIC_FILE` + `externalUrl`'s
  `FILE_EXTENSION`). Duplicated in i18n-utils; no runtime dependency, no shared fixture this round. Known-extension
  list, not "any dot": 712 live routes on both sites have zero dotted path segments, and a dotted slug must stay a route.
- A trailing slash means a route (`/brochure.pdf/` is prefixed), same as link-utils' `$`-anchored test.
- A disabled locale is still prefixed, an unconfigured locale returns the href unchanged — identical to `localizePath`.
- `exclude` = whole-segment prefix match, case-sensitive, leading/trailing slashes optional, matched on the path
  before `?`/`#`, an entry with no segments is ignored.
- Every "unchanged" case returns the SAME string (`toBe`), so English output stays byte-identical.

## 1. `i18n-utils/src/index.ts`

Add after `localizePath` (before `stripLocalePrefix`):

```ts
// Union of link-utils' prefetch and filename extension lists; a /cn/ twin of a public/ file is always a 404.
const STATIC_FILE =
  /\.(?:xml|pdf|txt|json|csv|zip|rar|rss|docx?|xlsx?|pptx?|ics|jpe?g|png|gif|svg|webp|avif|ico|mp4|webm|mp3)$/i;

export interface LocalizeHrefOptions {
  exclude?: readonly string[];
}

function segmentsOf(href: string): string[] {
  return href.split(/[?#]/)[0].split("/").filter(Boolean);
}

export function localizeHref<L extends string>(
  config: LocalesConfig<L>,
  href: string,
  locale: L,
  options?: LocalizeHrefOptions,
): string {
  if (STATIC_FILE.test(href.split(/[?#]/)[0])) return href;
  const segments = segmentsOf(href);
  const excluded = (options?.exclude ?? []).some((entry) => {
    const prefix = segmentsOf(entry);
    return prefix.length > 0 && prefix.every((segment, i) => segments[i] === segment);
  });
  return excluded ? href : localizePath(config, href, locale);
}
```

Put the `LocalizeHrefOptions` interface up with the other interfaces at the top of the file (after `LocalesConfig`,
before `DefinedLocales`) so `DefinedLocales` can reference it; keep `STATIC_FILE` and `segmentsOf` next to `localizeHref`.

`DefinedLocales` gains, right after `localizePath`:

```ts
  localizeHref(href: string, locale: L, options?: LocalizeHrefOptions): string;
```

`defineLocales` binds it, right after `localizePath`:

```ts
    localizeHref: (href, locale, options) => localizeHref(config, href, locale, options),
```

## 2. `i18n-utils/src/index.test.ts`

Add `localizeHref` to the import list (alphabetical: between `localizePath`... note the existing import order is
`localeFromPath, type LocalesConfig, localizePath, otherLocales` — put `localizeHref` directly before `localizePath`).

Add `describe("localizeHref", …)` directly after the `localizePath` describe. Use the existing `MOSBUILD`, `ZH_OFF`,
`RED_SEA`, `unknown` helpers. Expected new tests ≈ 73 (report the actual number):

1. `it("returns the same string on an unprefixed locale")` — for each of
   `["/", "", "/about/", "about", "/about/?x=1#y", "/brochure.pdf", "/lp/components/", "/cn/about/", "https://x.test/a", "#top", "?page=2"]`
   assert `localizeHref(MOSBUILD, href, "en")` **toBe** `href`, and again with `{ exclude: ["/lp/components"] }`.
2. `it.each` prefixes `%j` as `%j` on `"zh-CN"`, and the result passed through again is unchanged (idempotent):
   ```
   ["/", "/cn/"], ["", "/cn/"], ["about", "/cn/about"], ["/about/", "/cn/about/"],
   ["/about/?x=1#y", "/cn/about/?x=1#y"], ["/?x", "/cn/?x"], ["/cnc-machines/", "/cn/cnc-machines/"],
   ["/articles/web-2.0-trends/", "/cn/articles/web-2.0-trends/"], ["/sectors/node.js/", "/cn/sectors/node.js/"],
   ["/lp/components-2/", "/cn/lp/components-2/"], ["/brochure.pdf/", "/cn/brochure.pdf/"]
   ```
3. `it.each` leaves externals alone on `"zh-CN"` (toBe same string):
   `"https://expopharmtech.com/about/", "http://x.test", "mailto:info@ite.group", "tel:+74951234567", "//cdn.test/x", "///about", "#speakers", "?page=2"`
4. `it.each` already prefixed, toBe same string on `"zh-CN"`:
   `"/cn", "/cn/", "/cn/about/", "/cn?x=1", "/cn#top", "cn/about", "/cn/brochure.pdf", "/cn/lp/components/"`
5. `it.each` static files, toBe same string on `"zh-CN"`:
   ```
   "/brochure.pdf", "/uploads/a.PDF?v=2", "/Brochure.PDF#page=2", "uploads/a.pdf", "/sitemap.xml", "/robots.txt",
   "/data.json", "/export.csv", "/archive.zip", "/archive.rar", "/feed.rss", "/doc.doc", "/doc.docx", "/sheet.xls",
   "/sheet.xlsx", "/deck.ppt", "/deck.pptx", "/event.ics", "/img.jpg", "/img.jpeg", "/img.png", "/img.gif",
   "/logo.svg", "/img.webp", "/img.avif", "/favicon.ico", "/clip.mp4", "/clip.webm", "/audio.mp3"
   ```
6. exclude, all on `"zh-CN"` with `{ exclude: ["/lp/components"] }` unless stated:
   - `it.each` excluded (toBe same string): `"/lp/components", "/lp/components/", "/lp/components/x/", "/lp/components?x=1", "/lp/components#y", "lp/components"`
   - `it.each` not excluded (prefixed `/cn` + href): `"/lp/", "/lp/components-x/", "/lpx/components/", "/x/lp/components/", "/LP/components/"`
   - `it("accepts entries with or without slashes")`: each of `["lp/components/"]`, `["/lp/components/"]`, `["/lp/components?x"]` excludes `"/lp/components/x/"`.
   - `it("ignores an entry with no segments")`: `{ exclude: ["", "/", "?x"] }` still prefixes `"/about/"`.
   - `it("matches any of several entries")`: `{ exclude: ["/lp/components", "/en-only"] }` excludes `"/en-only/x/"` and still prefixes `"/about/"`.
7. `it("prefixes a prefixed default and a disabled locale")`: `RED_SEA` en `"/dining/"` → `"/en/dining/"`; `RED_SEA` ar `"/"` → `"/ar/"`; `ZH_OFF` zh-CN `"/about/"` → `"/cn/about/"`.
8. `it("returns the href unchanged for an unconfigured locale")`: `localizeHref(MOSBUILD, "/about/", unknown("fr"))` toBe `"/about/"`.

In the existing `defineLocales` → "returns the config with every function bound to it" test add three lines after the
`localizePath` line:
```ts
    expect(locales.localizeHref("/about/", "zh-CN")).toBe("/cn/about/");
    expect(locales.localizeHref("/brochure.pdf", "zh-CN")).toBe("/brochure.pdf");
    expect(locales.localizeHref("/lp/components/x/", "zh-CN", { exclude: ["/lp/components"] })).toBe("/lp/components/x/");
```

## 3. `i18n-utils/README.md`

Keep the README's voice (short, tables, "unchanged" wording). Changes:

a. **Quick start** block: add after the `localizePath` line
   ```ts
   locales.localizeHref("/about/", "zh-CN");        // "/cn/about/" — a CMS link, after link-utils resolveHref
   locales.localizeHref("/brochure.pdf", "zh-CN");  // unchanged — a static file
   ```
b. **Real-world usage**: add a `components/NavigationLink.tsx` block after the `LocaleSwitch.tsx` block and before the
   `utils/api` block:
   ```tsx
   // components/NavigationLink.tsx — every CMS link; a client component because it reads the locale from context
   "use client";
   import { localizeHref } from "@prismetic/i18n-utils";
   import { resolveHref } from "@prismetic/link-utils";
   import Link from "next/link";
   import { useLocale } from "@/components/LocaleProvider";
   import { LOCALES } from "@/lib/i18n/locales";

   const ENGLISH_ONLY = ["/lp/components"];

   const NavigationLink = ({ children, href, target, ...props }: NavigationLinkProps) => {
     const { href: resolved, ...linkProps } = resolveHref(href, target);
     const localized = localizeHref(LOCALES, resolved, useLocale(), { exclude: ENGLISH_ONLY });
     return <Link href={localized} {...linkProps} {...props}>{children}</Link>;
   };
   ```
   One sentence after it: on an English page `localized` is the same string `resolveHref` returned, so English
   markup is byte-identical; zh redirect destinations go through the same call.
c. **API reference, entry `.`**: new `#### localizeHref(config, href, locale, options?)` section directly after the
   `localizePath` section. Content:
   - signature block:
     ```ts
     localizeHref<L extends string>(config: LocalesConfig<L>, href: string, locale: L, options?: { exclude?: readonly string[] }): string
     ```
   - one paragraph: the CMS counterpart of `localizePath`. Runs after link-utils `resolveHref`, on one href at a time.
     Rewrites relative internal links only; same-origin absolute URLs and links inside rich-text or markdown HTML
     are left as typed. Prefixes exactly like `localizePath`, except that a static file or an excluded path is
     returned unchanged.
   - table (same shape as the `localizePath` one):
     | `href` | unprefixed locale | `zh-CN` (`prefix: "cn"`) |
     | `"/"`, `""` | unchanged | `"/cn/"` |
     | `"/about/?x=1#y"` | unchanged | `"/cn/about/?x=1#y"` |
     | `"/cnc-machines/"` | unchanged | `"/cn/cnc-machines/"` |
     | `"/cn/about/"`, `"/cn?x=1"` | unchanged | unchanged — already prefixed, so a code-built link may pass through again |
     | `"https://…"`, `"//…"`, `"mailto:…"`, `"tel:…"`, `"#…"`, `"?…"` | unchanged | unchanged |
     | `"/brochure.pdf"`, `"/uploads/a.PDF?v=2"` | unchanged | unchanged — a static file |
     | `"/lp/components/x/"` with `exclude: ["/lp/components"]` | unchanged | unchanged |
   - **Static files**: the extension list (spell it out), tested case-insensitively on the path before `?`/`#`,
     the union of link-utils' two lists. A trailing slash means a route (`"/brochure.pdf/"` is prefixed) and a
     dotted slug such as `"/articles/web-2.0-trends/"` is a route.
   - **`exclude`**: each entry is matched as whole path segments from the start of the path, case-sensitively;
     `"/lp/components"` covers `/lp/components`, `/lp/components/x/` and `/lp/components?x=1` but not
     `/lp/components-x/` or `/x/lp/components/`. Slashes around an entry are optional; an entry with no segments
     is ignored. Matched against the unprefixed path.
   - A disabled locale is still prefixed; an unconfigured locale returns `href` unchanged. "Unchanged" always means
     the same string.
d. **Types** section: `Also exported: DefinedLocales<L>, LocalizeHrefOptions.` and add `localizeHref` to the
   `defineLocales` description sentence if it lists the bound functions (it says "every function below bound to
   it" — no change needed then).
e. **Limits**, first bullet, replace with: **`localizePath` is for code-built links and `localizeHref` for one CMS
   href at a time, after `resolveHref`.** Neither rewrites links inside rich text or markdown HTML, and
   `localizeHref` leaves a same-origin absolute URL (`https://expopharmtech.com/about/`) as typed.
f. New **## Upgrading to 0.3** section above "Upgrading to 0.2": purely additive. `localizeHref` and
   `LocalizeHrefOptions` are new on the `.` entry and `DefinedLocales` gains the bound method. No existing
   call changes and no output changes unless a site calls `localizeHref`.
g. **Development**: update the test count line to the real total.

## 4. Version

- `i18n-utils/package.json`: `"version": "0.3.0"`.
- Root `package-lock.json`: the `"i18n-utils": { "name": "@prismetic/i18n-utils", "version": "0.2.0"` entry
  (around line 55) → `"0.3.0"`. Run `npm install --package-lock-only` at the repo root and check
  `git diff package-lock.json`: it must show only that one version line. If it shows anything else, `git checkout
  package-lock.json` and edit the single line by hand.

## 5. Verify, build, pack

```bash
cd /Users/toso/Documents/Prismetic/npm-packges
npm test -w i18n-utils                 # all green, type errors: none
npm run build -w i18n-utils
mkdir -p /Users/toso/Documents/Prismetic/local-packs
npm pack -w i18n-utils --pack-destination /Users/toso/Documents/Prismetic/local-packs
tar tzf /Users/toso/Documents/Prismetic/local-packs/prismetic-i18n-utils-0.3.0.tgz
```

The tarball must contain exactly: `package/package.json`, `package/README.md`, `package/LICENSE`,
`package/dist/index.js`, `package/dist/index.d.ts`, `package/dist/react.js`, `package/dist/react.d.ts`
(no `src`, no tests, no tsconfig).

Smoke test from the tarball (scratch dir, not the repo):

```bash
mkdir -p /tmp/i18n-smoke && cd /tmp/i18n-smoke && rm -rf package && tar xzf /Users/toso/Documents/Prismetic/local-packs/prismetic-i18n-utils-0.3.0.tgz
node --input-type=module -e "
import { localizeHref, defineLocales } from './package/dist/index.js';
const c = { defaultLocale: 'en', locales: { en: { prefix: '', ogLocale: 'en_US', hreflang: ['en'] }, 'zh-CN': { prefix: 'cn', ogLocale: 'zh_CN', hreflang: ['zh-CN'] } } };
console.log(localizeHref(c, '/about/', 'zh-CN'), localizeHref(c, '/brochure.pdf', 'zh-CN'), localizeHref(c, '/lp/components/x/', 'zh-CN', { exclude: ['/lp/components'] }), localizeHref(c, '/about/', 'en'));
console.log(defineLocales(c).localizeHref('/', 'zh-CN'));
"
```
Expected output: `/cn/about/ /brochure.pdf /lp/components/x/ /about/` then `/cn/`.

## 6. Report back to npm-agent

Send: the actual new test count and total, the output tail of `npm test -w i18n-utils`, `git status --short`,
`git diff --stat`, the tarball path, the `tar tzf` listing, the smoke output, and anything you deviated from.

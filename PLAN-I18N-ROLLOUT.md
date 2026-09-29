# i18n rollout — package plan

Approved by the user 2026-09-29. Written by session `npm-packages` (reviewer). Implemented by session `npm-changes`.

Goal: move Mosbuild's Chinese-locale logic out of site code into the packages, so other sites can add a locale with config only.

## Roles

- **npm-changes** implements, in this repo only.
- **npm-packages** reviews each stage.
- **The user** commits and publishes. Nobody else does.
- **lang-review** owns the Mosbuild pilot and migrates it after each publish.

## Rules

1. Work only inside `/Users/toso/Documents/Prismetic/npm-packges`. Read Mosbuild for reference, never edit it or any other site.
2. No `git commit`, no `git push`, no `npm publish`, no branch switch. Leave the changes in the working tree.
3. Existing tests pass **unedited**. An edit to an existing test file is a design failure: stop and report.
4. These files stay byte-identical: `seo-utils/src/seo.ts`, `bilingual.ts`, `bilingualSitemap.ts`, `canonical.ts`, `noIndex.ts`, every existing `*.test.ts` and `__fixtures__`.
5. Comments: almost none. One short line only for a non-obvious why. No docblocks above types, options or functions. This is the user's standing rule and it overrides the density of the existing files.
6. Logs that report a rejected value use `console.error`, never `console.warn` (two Red Sea sites strip `warn`).
7. Any deviation from this plan: stop and ask `npm-packages`, do not pick.
8. `next-preview-core` is out of scope (user decision).

## Baseline (measured 2026-09-29)

- `npm test -w seo-utils` → 12 files, 320 tests, all passing.
- `npm test -w form-utils` → 1 file, 26 tests, all passing.
- Consumers: 27 ITE sites pin seo-utils `2.3.0` exact, 4 Red Sea sites pin `2.1.0` exact and use `./bilingual`.

## Reference code (read-only)

`/Users/toso/Documents/Prismetic/ite/Mosbuild` — uncommitted pilot:

- `lib/i18n/config.ts`, `lib/i18n/seo.ts`, `lib/i18n/getDictionary.ts`
- `components/LocaleProvider.tsx`, `components/LocaleSwitch.tsx`
- `next-sitemap.config.js`, `lib/siteConfig.js`, `components/Form.tsx`
- Decisions: `/Users/toso/Documents/Prismetic/ite/MOSBUILD-ZH-CN-PLAN.md`

## Shared locale shape

One plain object per site feeds both packages. No dependency between the packages: each declares the fields it reads, and the site's object satisfies both structurally.

```ts
const LOCALES = {
  defaultLocale: "en",
  locales: {
    en:      { prefix: "",   ogLocale: "en_US", hreflang: ["en"],          htmlLang: "en",    label: "EN" },
    "zh-CN": { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"], htmlLang: "zh-CN", label: "中文", enabled: ZH_ENABLED },
  },
};
```

- The key is the CMS locale code (`zh-CN`, case-sensitive).
- `prefix: ""` means unprefixed. A default locale may also carry a prefix (Red Sea style).
- `enabled` defaults to `true`. The site computes it. The packages never read an env var.

---

## Stage 1 — `@prismetic/seo-utils` 2.4.0

Additive. Minor.

### 1a. New entry `./localized`

New files `src/localized.ts`, `src/localized.test.ts`. Add `./localized` to `exports` in `package.json` (same shape as `./bilingual`). No React import, no top-level await: `lib/siteConfig.js` loads it with `require()`.

It wraps the main entry's `createSeo`. It does not reimplement the title or description ladder.

```ts
import type { CanonicalPolicy, CmsPageData, CmsSeo, NoIndexPolicy, SeoMetadata } from "./seo.js";

export interface SeoLocale {
  prefix: string;
  ogLocale: string;
  hreflang: readonly string[];
  enabled?: boolean;
}

export interface LocalizedSeoConfig {
  siteUrl: string;
  siteName: string;
  canonicalPolicy?: CanonicalPolicy;
  noIndexPolicy?: NoIndexPolicy;
  defaultLocale: string;
  locales: Record<string, SeoLocale>;
}

export interface LocalizedSeoMetadata extends Omit<SeoMetadata, "alternates"> {
  alternates: { canonical: string; languages?: Record<string, string> };
}

export interface LocalizedMetadataOptions {
  alternates?: Record<string, string | null | undefined>;
}

export type LocalizedGenerateSEOMetadata = (
  seoData: CmsSeo | null | undefined,
  route?: string | null,
  pageData?: CmsPageData,
  options?: LocalizedMetadataOptions,
) => LocalizedSeoMetadata;

export interface LocalizedSeo {
  forLocale(locale: string): { generateSEOMetadata: LocalizedGenerateSEOMetadata };
  localizedRoute(route: string, locale: string): string;
  localizedUrl(route: string, locale: string): string;
}

export function createLocalizedSeo(config: LocalizedSeoConfig): LocalizedSeo;

export function alternatesFromLocalizations<T extends { locale: string; publishedAt?: string | null }>(
  localizations: readonly T[] | null | undefined,
  toRoute: (localization: T) => string,
): Record<string, string>;
```

`route` is the path below the locale prefix (`"articles/x"`, `""` for the home). `options.alternates` maps a locale key to the route of the same document in that locale. A locale with no published counterpart is left out.

#### Rules

| # | Rule |
|---|---|
| R1 | One `createSeo` instance per locale, built with `locale: ogLocale` and the config's two policies. Called as `(guardedSeo, localizedRoute(route, locale), pageData)`. |
| R2 | With no hreflang to emit, return `createSeo`'s result as is: same keys, same order, no `languages` key (not `languages: undefined`). |
| R3 | hreflang is emitted only when the current locale is enabled **and** at least one other enabled locale has a string entry in `alternates`. `""` is a valid entry (the home). |
| R4 | `languages` order: locales in config insertion order, limited to the current locale plus its enabled counterparts; each locale's `hreflang` codes in order; then `x-default` → the default locale's URL, only when the default locale is in the set. |
| R5 | Every URL is `${siteUrl}/${localizedRoute}/` with a trailing slash; the home of an unprefixed locale is `${siteUrl}/`. |
| R6 | Route cleaning: trim, strip leading and trailing slashes. On a locale with a non-empty prefix, drop one leading segment equal to that prefix. On an unprefixed locale strip nothing. Applies to `route` and to each `alternates` value (cleaned with its own locale). |
| R7 | Config validation at `createLocalizedSeo`, throwing an `Error`: `defaultLocale` missing from `locales`; duplicate prefix; more than one empty prefix; a prefix containing `/`; an empty `hreflang`; the same hreflang code on two locales. |
| R8 | Unknown locale in `forLocale`: clamp to `defaultLocale` and `console.error`. Never throw there (same as `./bilingual`, decision 5 of 2026-09-08). |
| R9 | No `openGraph.alternateLocale`. The pilot does not emit it. |

#### Canonical guard (runs before delegating)

Input: `seoData.canonicalURL`. Only a non-blank string that parses with `new URL()` **and** has the site's host is examined. Everything else goes to `createSeo` untouched, so the site's `canonicalPolicy` still decides.

1. **Owner.** Take the first path segment. The owner is the locale whose non-empty prefix equals that segment (whole segment: `/cnc-machines/` is not `cn`). Otherwise the owner is the unprefixed locale, if one exists.
2. **Wrong locale.** Owner differs from the current locale → reject. This is symmetric: a zh page claiming an English URL, and an English page claiming a `/cn/` URL. A disabled locale's prefix still counts.
3. **Locale home.** Owner is the current locale, the page is not the home (`route` is non-empty), and the canonical is that locale's home → reject.
4. **Reject** means: pass a shallow copy of `seoData` with `canonicalURL: null`, and log once with `console.error`, prefix `[seo]`, naming the rejected value and the page's own path.
5. **Accept** means: pass `seoData` by reference, unchanged.

#### Tests (`src/localized.test.ts`)

- English equals the main entry: for a matrix of `seoData` / `route` / `pageData`, `JSON.stringify` of the default-locale result with no alternates equals `JSON.stringify(createSeo(sameOptions).generateSEOMetadata(...))`.
- Mosbuild zh home, pinned from the pilot's exported HTML:
  - canonical `https://mosbuildexpo.com/cn/`
  - `languages` exactly, in order: `en` → `https://mosbuildexpo.com/`, `zh-CN` → `https://mosbuildexpo.com/cn/`, `zh` → `https://mosbuildexpo.com/cn/`, `x-default` → `https://mosbuildexpo.com/`
  - `openGraph.locale` `zh_CN`
- Different slugs per locale: `alternates: { en: "articles/a" }` on zh route `articles/b`.
- No counterpart → no `languages` key.
- zh disabled → no `languages` on either locale, zh canonical still under `/cn/`.
- Default locale missing from the set → no `x-default`.
- The pageData title ladder works on zh (`Header.Title`, `Name` + `Title`).
- Guard: English canonical on a zh page; `/cn/` canonical on an English page; `/cn/` claimed by a zh sub-page; `/cn/` kept on the zh home; `/cnc-machines/` kept on an English page; a valid `/cn/x/` kept on a zh page; an off-site and an unparseable value reach `createSeo` untouched under both policies; one `console.error` per rejection, none on accept.
- R6 with `"cn/about"`, `"/cn/about/"`, `"about"`.
- Each R7 case throws. R8 clamps and logs.
- `alternatesFromLocalizations`: skips unpublished rows, keeps `""`, handles `null`.
- Three locales, one of them with a prefixed default.

### 1b. Sitemap alternates from the exported HTML

Edit `src/buildNoIndex.ts`. Re-export the new names from `src/sitemap.ts`. New test file `src/buildAlternates.test.ts`.

Constraints found in the existing tests:

- `buildNoIndex.test.ts` compares `ExportedPage` with `toEqual` → **do not add a key to `ExportedPage`**.
- It also asserts two reads for two calls (line 160-165) → **no caching by default**.

```ts
export interface ExportedAlternate { hreflang: string; href: string }

export interface SitemapAlternateRef { href: string; hreflang: string; hrefIsAbsolute: true }

export function inspectExportedAlternates(html: string): ExportedAlternate[];

export interface BuildNoIndexOptions {
  // existing options unchanged
  cache?: boolean;
}

export interface SitemapTransformConfig {
  outDir?: string | null;
  siteUrl?: string | null;
}

export interface BuildNoIndex {
  // existing members unchanged
  alternateRefs(path: string, config?: SitemapTransformConfig): SitemapAlternateRef[];
}
```

| # | Rule |
|---|---|
| S1 | `inspectExportedAlternates` reads only the `<head>`, takes `<link>` tags whose `rel` contains `alternate` and that carry both `hreflang` and `href`. Reuse the existing `attr()` helper (double, single and unquoted values). Decode `&amp;` in `href`. Document order is kept. |
| S2 | `cache: true` memoises one read per file for the instance, shared by `inspect`, `shouldExclude` and `alternateRefs`. Default `false` keeps today's behaviour. |
| S3 | `alternateRefs` drops an alternate whose target is on the site's own origin and is noindex, a redirect (when `excludeRedirects`), or has no exported file. Target file: `exportedFilesFor(new URL(href).pathname, outDir)`. |
| S4 | An alternate on another origin, or any alternate when `config.siteUrl` is absent, is kept unverified. |
| S5 | After S3, if no remaining alternate points at a page other than `path` itself, return `[]`. |
| S6 | Checking a target never calls `onExclude` and never logs the "No exported file" line. A dropped alternate logs one `console.error` naming the page and the target. |
| S7 | A page whose own file is missing returns `[]` silently. |

Why S3: an alternate that is not in the sitemap's own `<loc>` set is non-reciprocal, and Google discards the cluster.

Why not next-sitemap's global `alternateRefs`: it appends the page path to every href, which breaks prefixed paths.

Tests: the four Mosbuild links above parsed in order; single-quoted and unquoted attributes; `&amp;`; an RSS `rel="alternate"` without `hreflang` ignored; links in `<body>` ignored; S3 for noindex, redirect and missing target; S4; S5; S6 (spy on `onExclude`); `cache: true` reads each file once across `shouldExclude` + `alternateRefs`; `cache` omitted reads as today.

### 1c. Package housekeeping

- `package.json` version `2.4.0`, plus the root `package-lock.json` entry.
- README: a new `## Entry ./localized` section in the same format as the `./bilingual` one, the `alternateRefs` and `cache` additions under `createSitemapNoIndexFromBuild`, and a short "which entry do I use" note: `.` single language, `./localized` optional prefix per locale, `./bilingual` every locale prefixed.
- Leave `PROPOSAL-3.0-i18n.md` and `PLAN-2.2.0-portability.md` alone.

### Stage 1 done when

- `npm test -w seo-utils` passes: the 320 existing tests unedited, plus the new ones.
- `npm run build -w seo-utils` is clean and `dist/localized.js` + `.d.ts` exist.
- `node -e "require('./seo-utils/dist/localized.js')"` loads from the repo root.
- `git diff --stat` shows no change to the files listed in rule 4.

---

## Stage 2 — `@prismetic/i18n-utils` 0.1.0 (new package)

Scaffold from `link-utils` (package.json fields, tsconfig, `.gitignore`, LICENSE, README layout, vitest). Add it to the root `workspaces` and the root lockfile. `peerDependencies`: `react >=18`. No `next` import anywhere.

Two entries:

| Entry | Content | Loadable from |
|---|---|---|
| `.` | pure functions and types | Node, server and client |
| `./react` | provider and hooks, files start with `"use client"` | client |

### `.` — pure

```ts
export interface LocaleDefinition {
  prefix: string;
  ogLocale: string;
  hreflang: readonly string[];
  enabled?: boolean;
  htmlLang?: string;
  label?: string;
}

export interface LocalesConfig<L extends string = string> {
  defaultLocale: L;
  locales: Record<L, LocaleDefinition>;
}

export function isLocaleEnabled<L extends string>(config: LocalesConfig<L>, locale: L): boolean;
export function enabledLocales<L extends string>(config: LocalesConfig<L>): L[];
export function otherLocales<L extends string>(config: LocalesConfig<L>, locale: L): L[];
export function localizePath<L extends string>(config: LocalesConfig<L>, path: string, locale: L): string;
export function stripLocalePrefix<L extends string>(config: LocalesConfig<L>, segments: string[], locale: L): string[];
export function localeFromPath<L extends string>(config: LocalesConfig<L>, pathname: string): L;
export function htmlLangOf<L extends string>(config: LocalesConfig<L>, locale: L): string;
export function withLocale<T extends Record<string, unknown>, L extends string>(
  config: LocalesConfig<L>, variables: T | undefined, locale?: L,
): T | (T & { locale: L }) | undefined;

export function defineLocales<L extends string>(config: LocalesConfig<L>): /* config + the functions above bound to it */;

export type DictionaryShape<T> = /* T with every string literal widened to string, deep */;
export function defineDictionaries<L extends string, D>(dictionaries: Record<L, D>): (locale: L) => D;
```

| # | Rule |
|---|---|
| P1 | The standalone functions take the plain config first, so a server component can pass the config (serialisable) to a client component. `defineLocales` is the bound convenience for server and Node code. |
| P2 | `localizePath("/about/", locale)`: unprefixed locale returns the path unchanged; otherwise `/${prefix}${path}`. For code-built links only. CMS-typed links render as typed. |
| P3 | `localeFromPath` matches the first segment exactly and returns only an **enabled** locale, else the default. |
| P4 | `otherLocales` and `enabledLocales` return enabled locales only, in config order. |
| P5 | `withLocale`: the default locale adds nothing, so English CMS requests stay byte-identical. |
| P6 | `htmlLangOf` falls back to the locale key. |
| P7 | `defineLocales` validates like R7 in stage 1 and throws. |
| P8 | `localizePath` stays here, not in link-utils: it needs the locale config, and link-utils is config-free CMS href normalisation. |

### `./react`

```ts
export function LocaleProvider(props: { locale: string; children: React.ReactNode }): React.ReactElement;
export function useLocale<L extends string = string>(): L;
export function PathLocaleProvider(props: { config: LocalesConfig; children: React.ReactNode }): React.ReactElement;
export function useLocaleSwitch(options: {
  hreflang: string;
  fallback: string;
  pathname?: string | null;
}): {
  href: string;
  linkProps: {
    href: string;
    hrefLang: string;
    lang: string;
    onPointerDown: React.PointerEventHandler<HTMLAnchorElement>;
    onFocus: React.FocusEventHandler<HTMLAnchorElement>;
    onClick: React.MouseEventHandler<HTMLAnchorElement>;
  };
};
```

| # | Rule |
|---|---|
| H1 | Use `Context.Provider` through `createElement`, so React 18 works. |
| H2 | `useLocale` throws nothing outside a provider: the context default is `""` and the site's wrapper maps it to its default locale. Document this. |
| H3 | `PathLocaleProvider` is for the single static `404.html`: after mount it reads `window.location.pathname`, sets `document.documentElement.lang` with `htmlLangOf`, and provides that locale. Before mount it provides the default locale. |
| H4 | `useLocaleSwitch` reads `link[rel="alternate"][hreflang="<code>"]` from the document and returns the `pathname` of its `href` (so a preview host stays on its own origin), else `fallback`. |
| H5 | It re-reads in an effect keyed on `hreflang` and `pathname`, and again on pointerdown, focus and click, writing `event.currentTarget.href` before the browser follows the link. Client navigation swaps the head after the effect ran. |
| H6 | The site passes `usePathname()` as `pathname`. The package never imports `next/navigation`. |
| H7 | The switcher's markup and styling stay in the site. The hook returns props only. |

### Tests

- Pure entry: every function, with the Mosbuild config and with a config whose default locale is prefixed; disabled locale in P3 and P4; P7 throws.
- `DictionaryShape`: a type-level test that a zh dictionary with different strings satisfies the en shape, and that a missing key fails (`// @ts-expect-error`).
- `./react`: follow `article-filters`' test setup for component tests. Cover H3, H4 and H5 (head swapped between render and click).

### Stage 2 done when

- `npm test -w i18n-utils` and `npm run build -w i18n-utils` pass.
- `node -e "require('./i18n-utils/dist/index.js')"` loads without React being evaluated.
- `dist/react.js` still starts with `"use client"`.
- README covers install, the config, both entries, and a Mosbuild-shaped example.

---

## Stage 3 — `@prismetic/form-utils` 1.3.0

Additive. Minor.

```ts
export const RECAPTCHA_NET_HOST = "www.recaptcha.net";
export function rewriteRecaptchaHost(html: string, host?: string): string;
export function isActiveCampaignSimpleEmbed(html: string): boolean;

export interface HTMLContentProps {
  // existing props unchanged
  recaptchaHost?: string;
}
```

| # | Rule |
|---|---|
| F1 | `rewriteRecaptchaHost` replaces every `www.google.com/recaptcha/` with `${host}/recaptcha/`. Default host `www.recaptcha.net`. A non-string input is returned as is. Nothing else on `google.com` is touched. |
| F2 | `HTMLContent` with `recaptchaHost` set rewrites the HTML before inserting it. Without the prop, behaviour is byte-identical to 1.2.1. |
| F3 | `recaptchaHost` must not reach the DOM: take it out of `...rest`. |
| F4 | With `recaptchaHost` set and a simple embed (`embed.php`) in the HTML, log one `console.error` during server render only (`typeof window === "undefined"`), saying the host cannot be switched and the full embed code is needed. |
| F5 | README: `www.recaptcha.net` is Google's documented host for regions where `www.google.com` is blocked; the site decides per locale whether to pass the prop. |

Tests: F1 on script `src`, inline script strings, several occurrences, no occurrence, custom host, non-string; `isActiveCampaignSimpleEmbed` true and false cases; the 26 existing tests unedited.

Done when `npm test -w form-utils` and `npm run build -w form-utils` pass, version is `1.3.0`, and the root lockfile entry is updated.

---

## Order and reporting

1. Stage 1, then report.
2. Stage 2, then report.
3. Stage 3, then report.

Carry on to the next stage after reporting. The stages touch separate directories, so review runs in parallel. If a review asks for changes, fix them before continuing.

Each report to `npm-packages`:

- files added and changed
- test counts before and after, with the failing output verbatim if any
- every deviation from this plan and why
- open questions

## After review (not npm-changes' work)

1. The user commits and publishes the reviewed package.
2. lang-review swaps Mosbuild's site code for the package and checks that the exported HTML, English and Chinese, is identical to the pilot's.

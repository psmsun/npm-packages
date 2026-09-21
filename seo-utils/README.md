# @prismetic/seo-utils

> Built for Prismetic's ITE and Red Sea Strapi-backed Next.js sites. The CMS
> field names, content-type uids and route shapes below are theirs; the policies
> and helpers are generic.

Next.js App Router metadata, JSON-LD and next-sitemap helpers for the Strapi-backed ITE
sites. Since 2.3 the sitemap's noindex exclusions are read from the exported HTML, so a
page's own metadata is the only place indexability is declared. One implementation replaces the per-repo `lib/seo.js`, `lib/jsonLd.tsx`,
`lib/sitemapNoIndex.js` and (Mosbuild) `lib/generateLlmsTxt.js`; those files are deleted
and the repos use the package directly.

## Install

```bash
npm install @prismetic/seo-utils --save-exact   # exact pin, no caret
```

Four entries. The first two are the single-language ITE pair and are unchanged since 2.0;
the `bilingual` pair was added in 2.1 for sites whose URLs carry a locale segment.

| Entry | For | Imports React | Runs |
| --- | --- | --- | --- |
| `@prismetic/seo-utils` | page metadata and JSON-LD | yes | build + request |
| `@prismetic/seo-utils/sitemap` | `next-sitemap.config.js` — noIndex exclusions, robots.txt Content-Signal, llms.txt | no | Node only, never bundled |
| `@prismetic/seo-utils/bilingual` | page metadata for localized URLs (`/en/…`, `/ar/…`) | no | build + request |
| `@prismetic/seo-utils/bilingual/sitemap` | sitemap helpers for those sites | no | Node only |

Nothing in the `bilingual` entries is reachable from `.` or `./sitemap`, which is how a
single-language site is guaranteed the output it had in 2.0.

## Requirements

| | |
| --- | --- |
| Module format | **ESM.** CommonJS files such as `lib/siteConfig.js` and `next-sitemap.config.js` load it with a plain `require()` through Node's `require(esm)` |
| Node | **20.19+ / 22.12+** for that `require(esm)` path; older versions cannot load it from CJS |
| Peer | `react >=18` — accurate as declared; nothing here uses a React 19-only API |
| Next.js | not a peer dep and never imported. `SeoMetadata` is *structurally* assignable to Next's `Metadata` |
| `"use client"` | not needed anywhere — `JsonLd` is a server component and everything else is a plain function |
| Tested against | React 19 / Next 16 |

The `./sitemap` and `./bilingual/sitemap` entries are deliberately free of React and of
top-level `await` so `require(esm)` keeps working from a CJS config.

Using this outside the ITE fleet? See [Portability](#portability) for what is generic,
what assumes Strapi, and what is ITE-specific.

## Quick start

Bind `generateSEOMetadata` once next to the site identity:

```js
// lib/siteConfig.js
const { createSeo } = require("@prismetic/seo-utils");

const SITE_URL = "https://expopharmtech.com";
const SITE_NAME = "Pharmtech & Ingredients";

module.exports = {
  SITE_URL,
  SITE_NAME,
  generateSEOMetadata: createSeo({ siteUrl: SITE_URL, siteName: SITE_NAME })
    .generateSEOMetadata,
};
```

Then use it in any page:

```ts
import { generateSEOMetadata } from "@/lib/siteConfig.js";

export async function generateMetadata() {
  return generateSEOMetadata(seoData, "about", pageData);
}
```

### Real-world usage

With the strict policies enabled and the Open Graph locale set:

```js
module.exports = {
  SITE_URL,
  SITE_NAME,
  generateSEOMetadata: createSeo({
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    locale: "ru_RU",                         // Open Graph locale, defaults to "en_US"
    canonicalPolicy: "strict-same-origin",   // default "passthrough"
    noIndexPolicy: "strict",                 // default "truthy"
  }).generateSEOMetadata,
};
```

Both policies default to 2.0 behaviour, so a site that does not pass them is unaffected —
that is what the 109 original tests and `mainEntryUnchanged.test.ts` pin. See
[ITE: enabling the strict checks](#ite-enabling-the-strict-checks) before turning them on.

---

# API reference

## Entry `.` — page metadata and JSON-LD

### `createSeo(config)`

```ts
createSeo(config: SeoConfig): { generateSEOMetadata: GenerateSEOMetadata }
```

| `config` field | type | default | |
| --- | --- | --- | --- |
| `siteUrl` | `string` | — | site origin, e.g. `"https://expopharmtech.com"`. A trailing slash is stripped |
| `siteName` | `string` | — | the event's name. Open Graph site name, and last-resort page title |
| `locale` | `string` | `"en_US"` | Open Graph locale |
| `canonicalPolicy` | `"passthrough" \| "strict-same-origin"` | `"passthrough"` | how far to trust a CMS `canonicalURL` |
| `noIndexPolicy` | `"truthy" \| "strict"` | `"truthy"` | how to read `seo.noIndex` |

Returns an object with one member. Binding it once per site is the intended use; the
returned function closes over the config.

### `generateSEOMetadata(seoData, path?, pageData?)`

```ts
type GenerateSEOMetadata = (
  seoData: CmsSeo | null | undefined,
  path?: string | null,
  pageData?: CmsPageData,
) => SeoMetadata;
```

| param | type | |
| --- | --- | --- |
| `seoData` | `CmsSeo \| null \| undefined` | the page's Strapi `seo` component |
| `path` | `string \| null` | the page's path below the origin, e.g. `"about"` |
| `pageData` | `CmsPageData` | the page record itself, for the title/description fallback chains |

Returns a `SeoMetadata` object — title, description, keywords, canonical, Open Graph,
Twitter and robots. See [Page metadata](#page-metadata) for the fallback chains and the
rules that govern each field.

### `<JsonLd />`

```tsx
<JsonLd seo={seoData} />
```

| prop | type | |
| --- | --- | --- |
| `seo` | `CmsSeoJsonLd` | anything with a `JSON_LD` field; `null`/`undefined` renders nothing |

Renders each object in the CMS `seo.JSON_LD` field (a JSON string, an object or an
array) as an `application/ld+json` script, and nothing when the field is empty or
invalid.

A plain `<script>` tag, not `next/script`, so the App Router can hoist it server-side.
`<` is escaped to `<` in the payload so a string value can never close the script
tag early.

### `getStructuredDataScriptInnerHtmls(jsonLdField)`

```ts
getStructuredDataScriptInnerHtmls(jsonLdField: unknown): string[]
```

The escaped JSON strings `JsonLd` would render, for custom rendering. Never throws:

| input | result |
| --- | --- |
| a JSON string (BOM and whitespace tolerated) | parsed, then treated as below |
| an array | every non-null object element |
| an object | one element |
| a `Date`, a primitive, invalid JSON, `null` | `[]` |

### `summarise(text, max?)`

```ts
summarise(text: unknown, max = 150): string | null
```

Collapses a rich-text summary into something usable as a meta description. Returns `null`
for a non-string or a value that cleans to nothing.

In order: `<style>` and `<script>` blocks are removed **including their inner text**, then
all tags, then the six common entities (`&nbsp; &amp; &lt; &gt; &quot; &#39;`), then
whitespace is collapsed and trimmed. If the result is longer than `max` it is cut at the
last space and given an ellipsis. The default is 150 (160 before 2.2), so a cut description,
ellipsis included, stays under the 155-character and 985-pixel marks Screaming Frog flags.

```ts
summarise("<p>Hello&nbsp;world</p>");  // "Hello world"
summarise("   ");                      // null
summarise(42);                         // null
```

The `<style>`/`<script>` rule matters: a page whose `Content` embeds a form would
otherwise describe itself with that form's CSS.

### `cleanHeaderTitle(value)`

```ts
cleanHeaderTitle(value: unknown): string | null
```

Removes a `//` separator from a page heading, without touching `://` in a URL, then
collapses whitespace and tidies space before punctuation. Returns `null` for a non-string
or an empty result.

```ts
cleanHeaderTitle("Industry Insights // Hub");  // "Industry Insights Hub"
```

No truncation and no brand suffix — `Header.Title` is used as the editor wrote it.

### Types

```ts
interface SeoConfig {
  siteUrl: string;
  siteName: string;
  locale?: string;
  canonicalPolicy?: "passthrough" | "strict-same-origin";
  noIndexPolicy?: "truthy" | "strict";
}

/** The Strapi `seo` component as the sites query it. */
interface CmsSeo {
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | string[] | null;
  noIndex?: unknown;              // noIndexPolicy decides how it is read
  canonicalURL?: string | null;
  metaImage?: { url?: string | null } | null;
  [key: string]: unknown;
}

/** The page record. Shapes differ per content type, so this stays loose on purpose. */
type CmsPageData = Record<string, any> | null | undefined;

/** Structurally assignable to Next's `Metadata`. */
interface SeoMetadata {
  title: { absolute: string };
  description?: string;           // omitted when the page has no summary of its own
  keywords: string | string[] | null | undefined;
  alternates: { canonical: string };
  openGraph: {
    title: string;
    description?: string;
    url: string;
    siteName: string;
    locale: string;
    type: "website";
    images?: Array<{ url: string; width: number; height: number; alt: string }>;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description?: string;
    images?: string[];
  };
  robots: { index: boolean; follow: boolean; googleBot: { index: boolean; follow: boolean } };
}
```

Also exported: `GenerateSEOMetadata`, `CmsSeoJsonLd`.

**Not exported from this entry**, though they exist in the source: `CanonicalPolicy`,
`NoIndexPolicy`, `SeoRobots`, `parseNoIndex` and `NoIndexVerdict`. Pass the policy values
as string literals; `parseNoIndex` is reachable from the two `bilingual` entries.

---

## Entry `./sitemap` — next-sitemap helpers

Node-only. Never bundled.

### `createSitemapNoIndexFromBuild(options?)`

```ts
createSitemapNoIndexFromBuild(options?: BuildNoIndexOptions): BuildNoIndex
```

| option | type | default | |
| --- | --- | --- | --- |
| `outDir` | `string` | the transform's `config.outDir`, then `"out"` | where `next build` exported the pages |
| `excludeRedirects` | `boolean` | `true` | leave `<meta http-equiv="refresh">` pages out |
| `readFile` | `(file) => string \| null` | `fs.readFileSync` | injectable for tests |
| `onExclude` | `(path, reason) => void` | one `console.log` line | called once per excluded path |

Returns:

```ts
interface BuildNoIndex {
  /** The exported page behind a sitemap path, or null when no file exists for it. */
  inspect(path: string, config?: { outDir?: string | null }): ExportedPage | null;
  /** True when the exported page must stay out of the sitemap. */
  shouldExclude(path: string, config?: { outDir?: string | null }): boolean;
}
```

```js
const {
  contentSignalRobotsTxt,
  createSitemapNoIndexFromBuild,
} = require("@prismetic/seo-utils/sitemap");
const buildNoIndex = createSitemapNoIndexFromBuild();

module.exports = {
  siteUrl: SITE_URL,
  outDir: "out",
  transform: async (config, path) => {
    if (buildNoIndex.shouldExclude(path, config)) return null;
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
      alternateRefs: config.alternateRefs ?? [],
    };
  },
};
```

`shouldExclude` reads the HTML that `next build` exported for the path — `out/a/b/index.html`
for `/a/b/`, then `out/a/b.html` — and returns true when its `<head>` says the page is not
one to list:

| the page renders | reason | why |
| --- | --- | --- |
| `<meta name="robots" content="noindex…">` or `"none"` | `noindex` | `robots: { index: false }` in its metadata, or `notFound()` — Next adds the tag itself |
| `<meta http-equiv="refresh">` | `redirect` | a `StaticRedirect`; a static export cannot emit a 3xx |

That is every page, CMS-driven or code-owned, with nothing to keep in sync: a page's own
metadata is the one place its indexability is declared, and the sitemap now reads it from
the same file the crawler will. A missing file is kept in the sitemap and reported with
`console.error` — the sitemap step must not fail a build. A page with no robots meta at all
is kept: the page, not the sitemap config, has to say noindex. See
[Sitemap: what the exported page says](#sitemap-what-the-exported-page-says).

### `createSitemapNoIndex(options?)` — deprecated

> **Deprecated in 2.3, removed in 3.0.** Kept working unchanged. It asks the CMS which
> records have `noIndex: true`, so it cannot see a code-owned page, a `__placeholder__` or
> a redirect, each of which needed its own regex in the config — and it disagrees with the
> rendered page whenever the CMS changed after the build. Use
> `createSitemapNoIndexFromBuild`.

```ts
createSitemapNoIndex(options?: SitemapNoIndexOptions): SitemapNoIndex
```

| option | type | default | |
| --- | --- | --- | --- |
| `contentTypes` | `readonly SitemapContentType[]` | `DEFAULT_CONTENT_TYPES` | collections to check |
| `fetch` | `FetchLike` | global `fetch` | injectable for tests |

Returns:

```ts
interface SitemapNoIndex {
  normalizeSitemapPath: (p: unknown) => string;
  /** Cached per redirects URL, so the transform hook can call it for every path. */
  getNoIndexPathSetPromise(redirectFetchUrl: string): Promise<Set<string>>;
}
```

```js
const {
  contentSignalRobotsTxt,
  createSitemapNoIndex,
} = require("@prismetic/seo-utils/sitemap");
const { normalizeSitemapPath, getNoIndexPathSetPromise } =
  createSitemapNoIndex();
```

`getNoIndexPathSetPromise(redirectsUrl)` resolves to the set of paths whose Strapi SEO
record has `noIndex: true`, derived from the site's `*-redirects` REST URL and cached per
URL. The default checks `pages`, `articles`, `sectors`, `medias` (under `/media-gallery/`)
and `partners`. Sites with other routes pass their own list:

```js
const {
  DEFAULT_CONTENT_TYPES,
  createSitemapNoIndex,
} = require("@prismetic/seo-utils/sitemap");

const { normalizeSitemapPath, getNoIndexPathSetPromise } =
  createSitemapNoIndex({
    contentTypes: [
      ...DEFAULT_CONTENT_TYPES,
      { uid: "campaign-pages", field: "PagePath", prefix: "lp" },
    ],
  });
```

Filtering happens in Strapi with `filters[seo][noIndex][$eq]=true` and a page size of 500.

### `DEFAULT_CONTENT_TYPES`

```ts
const DEFAULT_CONTENT_TYPES: readonly SitemapContentType[] = [
  { uid: "pages",    field: "PagePath" },
  { uid: "articles", field: "Slug", prefix: "articles" },
  { uid: "sectors",  field: "Slug", prefix: "sectors" },
  { uid: "medias",   field: "Slug", prefix: "media-gallery" },
  { uid: "partners", field: "Slug", prefix: "partner" },
  { uid: "peoples",  field: "Slug", prefix: "speakers" },
];
```

`uid` is the collection uid *without* the site's slug prefix — `"articles"` is queried as
`<site>-articles`.

### `normalizeSitemapPath(p)`

```ts
normalizeSitemapPath(p: unknown): string
```

The canonical form used as the set key: stringified, trimmed, trailing slashes stripped,
a leading slash added. `null`, `""` and `"/"` all become `"/"`.

```js
normalizeSitemapPath("about/");   // "/about"
normalizeSitemapPath("/about");   // "/about"
normalizeSitemapPath(null);       // "/"
```

Both sides of the comparison must go through it, which is why the factory hands it back
next to the set.

### `parseRedirectsApiUrl(redirectFetchUrl)`

```ts
parseRedirectsApiUrl(url: unknown): { apiBase: string; slugPrefix: string } | null
```

Derives the REST base and the site's slug prefix from its `*-redirects` endpoint URL,
matching `^(https?://host)/api/(<slug>)-redirects`. Returns `null` when it does not match.

### `contentSignalRobotsTxt(signal?)`

```ts
contentSignalRobotsTxt(signal?: string): TransformRobotsTxt
```

| param | default |
| --- | --- |
| `signal` | `DEFAULT_CONTENT_SIGNAL` = `"search=yes, ai-input=yes, ai-train=no"` |

Returns a next-sitemap `transformRobotsTxt` hook:

```js
module.exports = {
  generateRobotsTxt: true,
  robotsTxtOptions: {
    transformRobotsTxt: contentSignalRobotsTxt(),
  },
};
```

Inserts `Content-Signal: <signal>` directly under the `User-agent: *` group
(contentsignals.org: stay in search and AI-assistant answers, let assistants read pages to
answer users, withhold bulk model training). A robots.txt without a `User-agent: *` group
is returned unchanged.

### `generateLlmsTxt(options)`

```ts
generateLlmsTxt(options: LlmsTxtOptions): Promise<void>
```

| option | type | |
| --- | --- | --- |
| `siteUrl` | `string` | site origin without a trailing slash |
| `outDir` | `string` | export directory the file is written into, e.g. `"out"` |
| `strapiGraphqlUrl` | `string` | GraphQL endpoint |
| `homepageType` | `string` | GraphQL root of the homepage single type, e.g. `"mosBuildHomepage"` |
| `navBarType` | `string` | GraphQL root of the navbar single type, e.g. `"mosBuildNavBar"` |
| `fetch` | `PostFetchLike` | defaults to the global fetch |

Called as a side effect inside next-sitemap's `additionalPaths` hook:

```js
const { generateLlmsTxt } = require("@prismetic/seo-utils/sitemap");

module.exports = {
  additionalPaths: async (config) => {
    await generateLlmsTxt({
      siteUrl: config.siteUrl,
      outDir: config.outDir ?? "out",
      strapiGraphqlUrl: "https://ite-cms.prismetic.com/graphql",
      homepageType: "mosBuildHomepage",
      navBarType: "mosBuildNavBar",
    });
    return [];
  },
};
```

Writes `<outDir>/llms.txt` (llmstxt.org) from the homepage SEO title and description and
the navbar: every top-level item with a link, every dropdown as a heading with its links
beneath it. The site's homepage single type must expose `seo { metaTitle metaDescription }`
and its navbar single type `Data { Title LinkTo Links { Text LinkTo } }`; enabling it on
a new site means checking both root names and that shape first.

**Never throws.** See Limits.

### Types

```ts
interface SitemapContentType {
  uid: string;              // collection uid without the site's slug prefix
  field: string;            // "PagePath" for page-like types, "Slug" otherwise
  prefix?: string | null;   // URL segment the slug lives under; omit if field is a path
}

type FetchLike = (url: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
  status?: number;          // absent ⇒ the failure is not classified
  text?(): Promise<string>; // preferred over json() when reading an error body
}>;

type TransformRobotsTxt = (config: unknown, robotsTxt: string) => Promise<string>;

interface ExportedPage {
  robots: string | null;   // content of the first <meta name="robots">, null when absent
  noIndex: boolean;        // any robots meta says noindex or none
  redirect: boolean;       // <meta http-equiv="refresh"> present
}
type BuildExcludeReason = "noindex" | "redirect";
```

Also exported: `SitemapNoIndexOptions`, `SitemapNoIndex`, `BuildNoIndexOptions`,
`BuildNoIndex`, `SitemapTransformConfig`, `LlmsTxtOptions`, `PostFetchLike`,
`DEFAULT_CONTENT_SIGNAL`, and the two pure pieces of the build reader,
`inspectExportedHtml(html)` and `exportedFilesFor(path, outDir)`.

---

## Entry `./bilingual` — metadata for localized URLs

### `createBilingualSeo(config)`

```ts
createBilingualSeo(config: BilingualSeoConfig): BilingualSeo
```

| `config` field | type | default | |
| --- | --- | --- | --- |
| `siteUrl` | `string` | — | site origin; trailing slash stripped |
| `siteName` | `string` | — | last-resort title, *behind* the per-locale default |
| `locales` | `BilingualLocales` | — | required; this entry exists for localized URLs |
| `defaults` | `Record<string, BilingualLocaleDefaults>` | `{}` | per-locale last-resort title/description |
| `inherit` | `readonly string[]` | `[]` | fields `resolvePageSeo` may copy from the homepage |
| `loadHomepageSeo` | `(locale?) => Promise<unknown> \| unknown` | — | required for `inherit` to do anything |
| `hiddenBuildEnv` | `readonly HiddenBuildEnvRule[]` | `[]` | env rules that force the whole build noindex |

Returns `{ forLocale(locale, options?) }`.

### `seo.forLocale(locale, options?)`

```ts
forLocale(locale: string | undefined, options?: { available?: readonly string[] }):
  { generateSEOMetadata: BilingualGenerateSEOMetadata; resolvePageSeo: BilingualResolvePageSeo }
```

`available` narrows the hreflang set to the locales a page was actually translated into.
Omit it and every locale is advertised, which is what the fleet does today — and why one
site currently points an `hreflang="ar"` at a page that does not exist.

A locale that is not in `locales.all` is **clamped to `locales.default` and logged**, never
thrown: `generateMetadata` failing takes the whole build with it.

### `generateSEOMetadata(seoData, path?)` — bilingual

```ts
type BilingualGenerateSEOMetadata = (
  seoData: BilingualCmsSeo | null | undefined,
  path?: string | null,
) => BilingualSeoMetadata;
```

Takes **two arguments**. There is no `pageData` fallback chain here — the sites using this
entry always have an SEO record or a per-locale default, so the main entry's Title /
Header.Title / PageName ladder would be code no call site reaches. A third argument is
ignored.

A path may be passed with or without its locale prefix — `"dining"`, `"/ar/dining/"` and
`"en/dining"` all resolve to the same page.

### `resolvePageSeo(pageSeo)`

```ts
type BilingualResolvePageSeo = (pageSeo: unknown) => Promise<Record<string, unknown> | undefined>;
```

Returns a page's own `seo` untouched, and otherwise copies only the fields listed in
`inherit` from `loadHomepageSeo(locale)`. See [`inherit`](#inherit--what-a-page-may-take-from-the-homepage).

### `parseNoIndex(seo)`

```ts
parseNoIndex(seo: unknown): { noIndex: boolean; follow: boolean }
```

Also exported from `./bilingual/sitemap`, and shared on purpose: the sitemap must exclude
exactly the pages that render `<meta name="robots" content="noindex">`.

| `seo.noIndex` | verdict |
| --- | --- |
| `true`, `1`, or the strings `"true"`/`"1"`/`"yes"` (any case, trimmed) | `{ noIndex: true, follow: false }` |
| any other non-empty string (`"false"`, `"no"`, `"0"`) | indexed — an explicit negative is an answer, and does **not** fall through to `metaRobots` |
| absent, `null`, `false` | falls through to `metaRobots` / `meta_robots` / `robots` / `MetaRobots` |
| `metaRobots` containing `noindex` | `{ noIndex: true, follow: !/nofollow/ }` |
| anything else | `{ noIndex: false, follow: true }` |

`seo.NoIndex === true` is accepted as well as `seo.noIndex`.

### `sanitizeSameOriginCanonical(raw, options)`

```ts
sanitizeSameOriginCanonical(raw: unknown, options: SameOriginCanonicalOptions): string | null
```

| option | type | default | |
| --- | --- | --- | --- |
| `siteUrl` | `string` | — | site origin, trailing slashes already stripped |
| `pathSegment` | `string` | — | the page's path below any locale segment; `""` on a home page |
| `homes` | `readonly string[]` | — | URLs a sub-path must not claim; ignored when `pathSegment` is empty |
| `onReject` | `(message: string) => void` | `console.error` | where rejections go |

Returns the accepted canonical, or `null` so the caller falls back to the computed
per-path one. Accepts only an absolute URL on the same scheme and host that is not a home
page claimed by a sub-path.

### Types

```ts
interface BilingualLocales {
  all: readonly string[];              // hreflang order, e.g. ["en", "ar"]
  default: string;                     // x-default, and the clamp target
  ogLocale?: Record<string, string>;   // { en: "en_US", ar: "ar_SA" }
}

interface BilingualLocaleDefaults { title?: string; description?: string }

interface HiddenBuildEnvRule { name: string; equals: string }

interface BilingualSeoMetadata {
  title: { absolute: string };
  description?: string;
  keywords?: string | string[];        // the key is omitted when the CMS value is empty
  alternates: { canonical: string; languages: Record<string, string> };
  openGraph: { /* …as SeoMetadata, plus: */ alternateLocale?: string[] };
  twitter: { card: "summary_large_image"; title: string; description?: string; images?: string[] };
  robots: { index: boolean; follow: boolean; googleBot: { index: boolean; follow: boolean } };
}
```

`BilingualCmsSeo` matches `CmsSeo` except that `metaImage` is `unknown`: Strapi v5 is flat
(`{ url }`), v4 wraps it (`{ data: { attributes: { url } } }`), and both are resolved.

Also exported: `BilingualSeoConfig`, `BilingualSeo`, `BoundBilingualSeo`,
`ForLocaleOptions`, `BilingualSeoRobots`, `NoIndexVerdict`, `SameOriginCanonicalOptions`.

Deliberately **not** the main entry's `SeoMetadata`: `keywords` is omitted here rather
than always emitted, and `alternates.languages` / `openGraph.alternateLocale` do not exist
there.

---

## Entry `./bilingual/sitemap`

### `createLocaleSitemapNoIndex(options)`

```ts
createLocaleSitemapNoIndex(options: LocaleSitemapNoIndexOptions): LocaleSitemapNoIndex
```

| option | type | default | |
| --- | --- | --- | --- |
| `apiBase` | `string` | — | Strapi origin |
| `shape` | `"v4" \| "v5"` | — | response shape of that box. **Not cosmetic** — see below |
| `locales` | `readonly string[]` | `["en"]` | locale segments to walk |
| `singleTypes` | `readonly SitemapSingleType[]` | `[]` | `{ uid, segments }` |
| `collections` | `readonly SitemapCollection[]` | `[]` | `{ uid, field, prefix? }` |
| `extraPathsEnv` | `string` | — | env var of extra comma-separated paths to exclude |
| `fetch` | `FetchLike` | global `fetch` | injectable for tests |

Returns `{ normalizeSitemapPath, getNoIndexPathSetPromise() }` — note
`getNoIndexPathSetPromise` takes **no argument** here (the redirects-URL version takes the
redirects URL) and caches on the configured base.

### `localeAlternateRefs(siteUrl, path, locales, options?)`

```ts
localeAlternateRefs(
  siteUrl: string,
  path: string,
  locales: readonly string[],
  options?: { xDefault?: string; existsIn?: (locale: string, restPath: string) => boolean },
): AlternateRef[]
```

| param | default | |
| --- | --- | --- |
| `xDefault` | `locales[0]` | locale used for x-default |
| `existsIn` | every locale exists | pass it to stop advertising a translation that was never authored |

Returns `{ href, hreflang, hrefIsAbsolute: true }[]` for next-sitemap's `transform` hook.
Every href gets a trailing slash — with `trailingSlash: true` an href without one is not
the page's canonical and is not in the sitemap's own `<loc>` set, which is the
non-reciprocity condition that makes Google discard the cluster.

```js
const {
  createLocaleSitemapNoIndex,
  localeAlternateRefs,
} = require("@prismetic/seo-utils/bilingual/sitemap");

const { normalizeSitemapPath, getNoIndexPathSetPromise } = createLocaleSitemapNoIndex({
  apiBase: "https://prod-shebara-cms.prismetic.com",
  shape: "v4",                       // v4: rows wrapped in `attributes`. v5: flat rows.
  locales: ["en", "ar"],
  singleTypes: [
    { uid: "homepage", segments: [] },
    { uid: "dining", segments: ["dining"] },
  ],
  collections: [{ uid: "campaign-pages", field: "Path" }],
  extraPathsEnv: "SITEMAP_NOINDEX_PATHS",   // comma-separated, e.g. "/en/internal,/ar/internal"
});

module.exports = {
  siteUrl: SITE_URL,
  transform: async (config, path) => {
    if ((await getNoIndexPathSetPromise()).has(normalizeSitemapPath(path))) return null;
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      alternateRefs: localeAlternateRefs(config.siteUrl, path, ["en", "ar"]),
    };
  },
};
```

### Types

```ts
type CmsShape = "v4" | "v5";
interface SitemapSingleType { uid: string; segments: string[] }
interface SitemapCollection { uid: string; field: string; prefix?: string | null }
interface AlternateRef { href: string; hreflang: string; hrefIsAbsolute: true }
```

Also exported: `LocaleSitemapNoIndexOptions`, `LocaleSitemapNoIndex`,
`LocaleAlternateOptions`, `normalizeSitemapPath`, `FetchLike`, `parseNoIndex`,
`NoIndexVerdict`.

---

# Behaviour

## Page metadata

`generateSEOMetadata(seoData, path, pageData)` returns a Next `Metadata` object (title,
description, keywords, canonical, Open Graph, Twitter, robots). Nothing is ever inherited
from the homepage:

| | chain |
| --- | --- |
| title | `seo.metaTitle` → `Title` → `Header.Title` → `PageName` → `siteName` |
| description | `seo.metaDescription` → `Excerpt` → `ShortText` → `Content` → `Header.Content` → *omitted* |

A record with a `Name` (speakers, partners) uses `Name — Title` (capped at 60 characters)
as its title instead, since there `Title` is the job title, and `Name — Title, Company` as
its description ahead of any `Header.Content`. `Header.Title` loses a `//`
separator ("Industry Insights // Hub" → "Industry Insights Hub") but is otherwise
untouched — no truncation, no brand suffix. Summaries are trimmed to 150 characters at a
word boundary and stripped of `<style>`/`<script>` blocks, HTML tags and the six common
entities. Every source is trimmed before it is tested, so a field saved as a single space
counts as absent.

**A page with no summary anywhere gets no description at all** — `description`,
`openGraph.description` and `twitter.description` are omitted rather than filled with a
site-wide string that says nothing about the page. A CMS canonical that points at the
site root is ignored on any non-root path, so a page inheriting the homepage's SEO record
never declares itself a duplicate of the homepage.

## ITE: enabling the strict checks

Two opt-in options on `createSeo`. Both default to 2.0 behaviour, so a site that does not
pass them is unaffected — that is what the 109 original tests and
`mainEntryUnchanged.test.ts` pin.

### `canonicalPolicy: "strict-same-origin"`

A CMS `canonicalURL` is used only when it is an absolute `http(s)` URL on the site's own
scheme and host, and is not the site root claimed by a sub-path. Anything else falls back
to the computed per-path canonical and is logged with `console.error`.

| CMS value | passthrough (default) | strict-same-origin |
| --- | --- | --- |
| `https://site/other/` | used | used |
| `https://site/other/ ` (trailing space) | used, space and all | trimmed, then used |
| `http://site/other/` on an https site | used as-is | **rejected** → computed URL, never upgraded |
| `hhttps://site/x` | used as-is | **rejected** |
| a Google Sheets or other off-site link | used as-is | **rejected** |
| `seoteam@acronym.com`, `/about`, free text | resolved against `metadataBase` | **rejected** |
| `https://site/` on a sub-path | ignored (2.0 already guards this) | ignored |
| blank / absent | computed URL | computed URL, silently |

A rejected canonical is replaced by the page's own URL. It is never rewritten — an
`http://` value does not become `https://`, it is discarded.

### `noIndexPolicy: "strict"`

| CMS value | truthy (default) | strict |
| --- | --- | --- |
| `true` / `1` / `"yes"` | noindex, nofollow | noindex, nofollow |
| `false` / `null` / absent | indexed | indexed |
| the string `"false"`, `"no"`, `"0"` | **noindex** | indexed |
| `metaRobots: "noindex, follow"` | **ignored** | noindex, **follow kept** |
| `metaRobots: "noindex, nofollow"` | ignored | noindex, nofollow |

### Expected effect

Enabling either option changes which pages are indexed, so run the CMS audit first and
turn them on with the specific list of pages the audit says they repair. The audit output
is the record of what changed and why; do not enable these blind.

## Sitemap: what the exported page says

`createSitemapNoIndexFromBuild` runs inside next-sitemap's `transform`, after `next build`,
so every path it is asked about is already an HTML file. It reads that file's `<head>` and
nothing else:

- **`noindex` wins over everything.** If any `<meta name="robots">` carries `noindex` or
  `none`, the page is out. That is what the crawler will read, so it is also what the
  sitemap says. The CMS is not consulted: a record that says `noIndex` but a page that
  renders `index, follow` is a page bug, and hiding it from the sitemap would not hide it
  from search.
- **A redirect is not a page.** `StaticRedirect` renders `<meta http-equiv="refresh">` and
  no robots meta; with `excludeRedirects: true` (default) it is left out. This replaces the
  per-path fetch of the `*-redirects` collection that the ITE configs used to make — one
  uncached HTTP request per sitemap entry.
- **`__placeholder__` needs no regex.** A route that calls `notFound()` renders with
  `<meta name="robots" content="noindex"/>`, which Next adds itself, so the reader drops it.
  A placeholder that *does not* call `notFound()` — one that renders a "No articles
  available" page with no robots meta — is a real, indexable page and stays in. Fix the
  page, not the config.
- **No robots meta means keep.** A page that declares nothing is treated as indexable,
  exactly as a crawler treats it.
- **A missing file means keep, loudly.** `console.error` names the path and the files it
  looked for. `next-sitemap` enumerates `.next/prerender-manifest.json`, not `out/`, so a
  path can in principle exist there without a file — that has not been seen on any site.
- **Cost.** One synchronous read per path, ~0.35 ms each on a 100 KB page. Mosbuild's 463
  pages take 163 ms; the largest ITE export (914 pages) stays under half a second.

Measured inside Mosbuild's real postbuild on 2026-09-21, the reader reproduces the
previous sitemap exactly — 435 entries, 7 noindex pages and 19 redirects dropped — with the
two regex guards, the per-path redirects fetch and the CMS query removed. `/404/` and
`/_not-found/` never reach `transform`; next-sitemap skips them itself.

## Sitemap fetch failures

`createSitemapNoIndex` (deprecated) classifies a failed collection query instead of swallowing every
non-OK response:

| response | behaviour |
| --- | --- |
| `404` | silent — the collection does not exist on this site |
| `400` whose body says `Invalid key seo` | silent — the collection has no `seo` component |
| `400` whose body says `Invalid key <field>` | `console.error` naming the uid and the configured field |
| any other status | `console.error` with the status code |
| a thrown fetch | `console.error`, as before |
| a response with no observable `status` | silent, as before |

The third row is the one that matters: a site whose collection spells the field `slug`
rather than `Slug` used to contribute nothing to the exclusion set and say nothing about
it. `peoples` (speakers, under `/speakers/`) joined `DEFAULT_CONTENT_TYPES` in 2.1; sites
without that collection answer 404 and stay silent.

## Bilingual sites

A site whose URLs carry a locale segment (`/en/dining/`, `/ar/dining/`) uses its own entry
point. `createSeo` is untouched by everything in this section.

```js
// lib/siteConfig.js — the Red Sea fleet
const { createBilingualSeo } = require("@prismetic/seo-utils/bilingual");

const SITE_URL = "https://www.shebara.sa";

const seo = createBilingualSeo({
  siteUrl: SITE_URL,
  siteName: "Shebara",                              // last resort, behind the per-locale default

  locales: {
    all: ["en", "ar"],
    default: "en",                                  // x-default, and the clamp target
    ogLocale: { en: "en_US", ar: "ar_SA" },
  },
  defaults: {
    en: { title: "Shebara", description: "Discover Shebara — …" },
    ar: { title: "شيبارا", description: "اكتشف شيبارا — …" },
  },

  // Only these three may be copied from the homepage by resolvePageSeo.
  inherit: ["metaTitle", "metaDescription", "metaImage"],
  loadHomepageSeo: async (locale) => (await getCachedHomepageData(locale))?.seo,

  hiddenBuildEnv: [
    { name: "NODE_ENV", equals: "development" },
    { name: "VERCEL_ENV", equals: "preview" },
    { name: "NEXT_PUBLIC_ROBOTS_NOINDEX", equals: "1" },
  ],
});

module.exports = { SITE_URL, seo };
```

```ts
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const { generateSEOMetadata, resolvePageSeo } = seo.forLocale(locale);
  return generateSEOMetadata(await resolvePageSeo(page?.seo), "dining");
}
```

Each page gets its locale segment in the canonical, `alternates.languages` (one entry per
locale plus `x-default`), `openGraph.alternateLocale`, the per-locale default title and
description, and an omitted `keywords` key when the CMS value is empty.

### This entry is always strict

There is no policy option to set wrong. A CMS `canonicalURL` is accepted only when it is an
absolute URL on the **same scheme and host**, and is not a home page (the site root or any
locale home) claimed by a sub-path. Anything else falls back to the computed per-path
canonical. An `http://` value on an `https` site is rejected, never silently upgraded.

This exists because a bare string resolves against `metadataBase`:
`seoteam@acronym.com` was pasted into the field and shipped as
`<link rel="canonical" href="https://site/seoteam@acronym.com">` on two production sites.
Relative values are rejected for the same reason — telling a valid path from a typo is
exactly what failed there.

**Rejections are logged with `console.error`, not `console.warn`.** Two of the four sites
using this entry build with `removeConsole: { exclude: ["error"] }`, so a warning would be
compiled out of the very builds it exists to report on.

`noIndex` is read from an explicit allowlist — `true`, `1`, `"true" | "1" | "yes"` — with
any other non-empty string treated as an explicit negative, falling back to `metaRobots` /
`robots`. `"noindex, follow"` keeps `follow: true` rather than collapsing to nofollow.

The main entry defaults to the looser `seo.noIndex ?? false` test, which reads the string
`"false"` as noindex and ignores `metaRobots`. Both are known to be wrong, and a
single-language site can opt out of them with `noIndexPolicy: "strict"` — see
[ITE: enabling the strict checks](#ite-enabling-the-strict-checks). It stays the default
because switching changes which pages are indexed, so it belongs to a per-site audit.

### `inherit` — what a page may take from the homepage

Default `[]`: nothing. `resolvePageSeo(pageSeo)` returns a page's own `seo` untouched and
otherwise copies only the listed fields.

Never list `canonicalURL`, `JSON_LD` or `noIndex`. An inherited canonical makes every page
without its own SEO declare itself a duplicate of the homepage, and search engines drop it
(this was live: five pages on one site, six on another). An inherited `JSON_LD` makes every
sub-page claim to be the resort entity. An inherited `noIndex` means one tick on the
homepage delists the whole site *and* empties the sitemap.

Note that a page whose `seo` is an empty `{}` counts as having its own and inherits
nothing. That is current fleet behaviour, kept deliberately; whether an empty CMS component
should mean "no SEO record" is an open question for the content team, not a code fix.

### `hiddenBuildEnv`

A list of `{ name, equals }` rules; when any matches, the whole build is `noindex, nofollow`.
Default `[]`, so no env var is read at all. Rules are looked up dynamically, which means
Next's build-time inlining of `process.env.FOO` does not apply — fine for `generateMetadata`,
which runs in Node during the build, but a rule here is invisible to client bundles.

### Why the bilingual sitemap filters client-side

`shape` is not cosmetic: a wrong value makes every `seo` read `undefined`, so nothing is
ever excluded and the sitemap ships noIndex pages. The mismatch is detected and logged with
`console.error` — check the postbuild log for `[sitemap] shape is …` before trusting an
export. This entry filters client-side, where `./sitemap` filters in Strapi with
`$eq: true`, because its noIndex rule is broader than that filter and the exclusion set must
match exactly the pages that render a noindex meta tag.

**No TLS override.** The package never sets `NODE_TLS_REJECT_UNAUTHORIZED`. A CMS whose
certificate chain Node cannot verify needs an explicit, per-site opt-in in that site's own
config — and only there.

# Portability

**No ITE domain or site name is hardcoded in the shipped code** — they appear only in
comments and test fixtures. What the package actually couples to is *field names* and
*URL conventions*, and that differs sharply per entry point.

## Works on any project

Pure functions with no CMS assumptions at all. Import and use them anywhere:

| export | entry |
| --- | --- |
| `summarise` | `.` |
| `cleanHeaderTitle` | `.` |
| `JsonLd`, `getStructuredDataScriptInnerHtmls` | `.` — generic apart from expecting the field to be named `JSON_LD` |
| `sanitizeSameOriginCanonical` | `./bilingual` |
| `normalizeSitemapPath` | `./sitemap`, `./bilingual/sitemap` |
| `localeAlternateRefs` | `./bilingual/sitemap` |
| `contentSignalRobotsTxt`, `DEFAULT_CONTENT_SIGNAL` | `./sitemap` |

## Works on any Strapi project

`createSeo` and `createBilingualSeo` read `metaTitle`, `metaDescription`, `keywords`,
`noIndex`, `canonicalURL` and `metaImage` — the **Strapi SEO plugin's** field names, not
an ITE invention. Any Strapi site using that plugin fits without modification.

`createLocaleSitemapNoIndex` takes a plain `apiBase` and your own uids and works against
Strapi v4 or v5 via `shape` — but **only for a site whose URLs carry a locale segment.**
See the sitemap note below.

`parseNoIndex` accepts `noIndex`, `NoIndex`, `metaRobots`, `meta_robots`, `robots` and
`MetaRobots`, so it tolerates most conventions.

## ITE-specific

- **`generateSEOMetadata`'s `pageData` fallback chain is hardcoded**: `Title`,
  `Header.Title`, `Header.Content`, `PageName`, `Name`, `Company`, `Excerpt`, `ShortText`,
  `Content`. There is no accessor option, unlike `@prismetic/article-filters`'
  `ArticleAccessors`. On another CMS these simply never match — see below.
- **`createSitemapNoIndexFromBuild` serves any `output: "export"` site** — it reads
  HTML, not a CMS. The two CMS-backed helpers do not: `createSitemapNoIndex`
  requires a `*-redirects` REST URL matching `/api/<slug>-redirects` and prefixes every
  collection with the slug it derives from it — `articles` is queried as
  `<slug>-articles`, ITE's multi-tenant naming. `createLocaleSitemapNoIndex` avoids that,
  but unconditionally prefixes `/<locale>` to every path it emits, so on a site whose URLs
  have no locale segment the exclusion set never matches:

  ```js
  createLocaleSitemapNoIndex({ apiBase, shape: "v5", locales: ["en"], … });
  // set contains "/en/about"; the sitemap emits "/about" → no match, nothing excluded
  // locales: [""] does not help — it yields the malformed "//about"
  ```

  **This fails silently**: no error, an empty-looking exclusion set, and noIndex pages
  ship in the sitemap. Write the `transform` yourself instead — it is ~20 lines against
  your own CMS, and `normalizeSitemapPath` is exported so both sides of the comparison
  agree.
- **`generateLlmsTxt`** takes configurable GraphQL roots but a fixed query shape:
  `seo { metaTitle metaDescription }` and `Data { Title LinkTo Links { Text LinkTo } }`.

## Using it on another project today

The hardcoded `pageData` chain **degrades gracefully rather than breaking** — unmatched
field names are simply absent, and the `seo` component carries the page:

```js
const { generateSEOMetadata } = createSeo({
  siteUrl: "https://acme.io",
  siteName: "Acme",
});

generateSEOMetadata(
  { metaTitle: "Pricing", metaDescription: "What it costs." },
  "pricing",
  { post_title: "Pricing", post_excerpt: "never read" },   // non-ITE field names
);
// title      → "Pricing"
// description→ "What it costs."
// canonical  → "https://acme.io/pricing/"

generateSEOMetadata(null, "pricing", { post_title: "Pricing" });
// title → "Acme"   — falls back to siteName, no crash, nothing undefined
```

So the recipe for another project is to **shape the first argument yourself** and skip the
third:

```js
const toSeo = (page) => ({
  metaTitle: page.post_title,
  metaDescription: page.post_excerpt,
  keywords: page.tags?.join(", "),
  canonicalURL: page.canonical_url,
  noIndex: page.noindex,
  metaImage: page.og_image ? { url: page.og_image } : null,
});

export async function generateMetadata() {
  return generateSEOMetadata(toSeo(page), page.slug);
}
```

That is a few lines per project and needs no change to this package. Making the mapping a
built-in `mapSeo` option, and replacing the hardcoded `pageData` chain with accessors, is
the natural next step if more than one non-ITE project needs it.

# Limits

- **A CMS failure in `generateLlmsTxt` is logged and swallowed**, so the build still
  succeeds but the deploy has no `llms.txt`. Kept from the original on purpose, so the
  sitemap step never fails a build. Look for `[llms.txt] generated → out/llms.txt` in the
  postbuild log before trusting an export.
- **A wrong `shape` on `./bilingual/sitemap` fails silently** apart from its
  `console.error`. Nothing is excluded and noIndex pages ship.
- **`./bilingual/sitemap` always prefixes `/<locale>`**, so it cannot serve a site whose
  URLs have no locale segment — and that one fails with no message at all. See
  [Portability](#ite-specific).
- **`forLocale` without `available` advertises every locale**, including translations that
  were never authored.
- **The main entry's default policies are known to be wrong** (`"false"` read as noindex;
  `metaRobots` ignored) and stay default because changing them changes which pages are
  indexed. They are a per-site audit decision.
- **`CanonicalPolicy`, `NoIndexPolicy`, `SeoRobots` and `parseNoIndex` are not exported
  from `.`** even though they exist in the source. Pass policies as string literals.
- **Requires Node 20.19+ / 22.12+** when loaded from a CommonJS config.
- **An empty `{}` SEO component counts as a page having its own**, so it inherits nothing.

# Upgrading to 2.3

**Additive. No output changes.** One new export on `./sitemap`,
`createSitemapNoIndexFromBuild`, plus its two pure pieces `inspectExportedHtml` and
`exportedFilesFor`. `createSitemapNoIndex` is deprecated but unchanged; it goes in 3.0.

A site that upgrades and does nothing else moves nothing. A site that switches its
`next-sitemap.config.js` to the build reader can delete three things from `transform`:

```diff
-const { normalizeSitemapPath, getNoIndexPathSetPromise } =
-  createSitemapNoIndex({ contentTypes: [...DEFAULT_CONTENT_TYPES, { uid: "campaign-pages", field: "PagePath", prefix: "lp" }] });
+const buildNoIndex = createSitemapNoIndexFromBuild();

   transform: async (config, path) => {
-    if (/\/__placeholder__\/?$/.test(path)) return null;
-    if (/\/lp\/campaign-components\/?$/.test(path)) return null;
-    if (await customIgnoreFunction(path)) return null;          // the redirects fetch
-    const noIndexSet = await getNoIndexPathSetPromise(REDIRECTS_FETCH_URL);
-    if (noIndexSet.has(normalizeSitemapPath(path))) return null;
+    if (buildNoIndex.shouldExclude(path, config)) return null;
     return { loc: path, /* … */ };
   },
```

Before switching, check two things in the site's own `out/`:

1. Every placeholder route calls `notFound()`. A placeholder that renders a page instead
   (`/articles/placeholder/`, `/articles/no-articles-available/`) has no robots meta and
   will be listed — as it already is today, since the `__placeholder__` regex never matched
   it either. Fix the route.
2. Any page the old config excluded by CMS `noIndex` renders `noindex` itself. It does when
   the route uses `generateSEOMetadata`; a route that builds its own metadata may not.

The sitemap should come out identical. Diff `out/sitemap.xml` before and after.

# Upgrading to 2.2

**One output change, main entry only.** A description generated from page content
(`Excerpt`, `ShortText`, `Content`, `Header.Content`, or a person's name line) is cut at
150 characters instead of 160, so that a cut description, ellipsis included, stays under
the 155-character and 985-pixel marks Screaming Frog flags. A crawl of four sites on 2.1
found every generated description that reached the old cap flagged as too long.

What moves on a site that upgrades:

- a generated description that was cut at 160 is cut at 150 instead;
- a source between 151 and 160 characters that used to pass through whole is now cut and
  given an ellipsis — the one case that gets shorter *and* loses its ending;
- a hand-written `seo.metaDescription` is never summarised and does not change;
- titles, canonicals, robots, JSON-LD, the sitemap helpers and the `./bilingual` entries,
  which never call `summarise`, do not change.

Consumers pin exact versions, so nothing moves until a site bumps. `summarise(text, 160)`
still gives the old cut where a site calls it directly.

# Upgrading to 2.1

**Nothing to do.** 2.1 adds two new entry points and changes nothing that an existing site
imports: `src/seo.ts`, `src/sitemap.ts` and `src/index.ts` are byte-identical to 2.0, and
the 109 tests written against 2.0 pass unedited.

Bilingual sites move their `lib/seo.js` and `lib/sitemapNoIndex.js` onto
`@prismetic/seo-utils/bilingual` and `/bilingual/sitemap`. `src/__fixtures__/redsea/` holds
1,080 cases captured from four live bilingual sites that those entries must reproduce.

# Upgrading to 2.0

`createSeo` no longer takes `siteTitle` or `siteDescription`; it takes `siteName` — the
event's name, used as the Open Graph site name and as the last-resort page title. Each
site's `lib/siteConfig.js` swaps its two constants for one `SITE_NAME`, and `app/layout.tsx`
uses it as the root `title` with no root `description`. Delete the
`if (!seo) seo = await fetchHomepageSEO()` fallback in front of every `<JsonLd>`: a page
with no SEO record of its own now renders no JSON-LD rather than the homepage's.

# Development

```bash
npm test -w seo-utils      # vitest — 280 tests across 11 files
npm run build -w seo-utils
```

`src/__fixtures__` holds byte-identical copies of the two legacy `lib/seo.js` variants and
of Mosbuild's `lib/generateLlmsTxt.js`; the tests prove the package reproduces them.
`redsea.golden.test.ts` replays 1,080 cases captured from four live bilingual sites, and
`mainEntryUnchanged.test.ts` pins the main entry against 2.0.

# License

MIT

# @prismetic/seo-utils

Next.js App Router metadata, JSON-LD and next-sitemap helpers for the Strapi-backed ITE
sites. One implementation replaces the per-repo `lib/seo.js`, `lib/jsonLd.tsx`,
`lib/sitemapNoIndex.js` and (Mosbuild) `lib/generateLlmsTxt.js`; those files are deleted
and the repos use the package directly.

## Install

```bash
pnpm add @prismetic/seo-utils --save-exact   # exact pin, no caret
```

Four entries. The first two are the single-language ITE pair and are unchanged since 2.0;
the `bilingual` pair was added in 2.1 for sites whose URLs carry a locale segment.

- `@prismetic/seo-utils` — page metadata and JSON-LD (imports React).
- `@prismetic/seo-utils/sitemap` — Node-only helpers for `next-sitemap.config.js`
  (noIndex exclusions, robots.txt Content-Signal, llms.txt). Never bundled.
- `@prismetic/seo-utils/bilingual` — page metadata for localized URLs (`/en/…`, `/ar/…`).
  No React import.
- `@prismetic/seo-utils/bilingual/sitemap` — Node-only sitemap helpers for those sites.

Nothing in the `bilingual` entries is reachable from `.` or `./sitemap`, which is how a
single-language site is guaranteed the output it had in 2.0.

The package is ESM. CommonJS files such as `lib/siteConfig.js` and
`next-sitemap.config.js` load it with a plain `require()` through Node's `require(esm)`
(Node 20.19+ / 22.12+); older Node versions cannot.

## Page metadata — `lib/siteConfig.js`

Bind `generateSEOMetadata` once next to the site identity and import it from there:

```js
const { createSeo } = require("@prismetic/seo-utils");

const SITE_URL = "https://expopharmtech.com";
const SITE_NAME = "Pharmtech & Ingredients";

module.exports = {
  SITE_URL,
  SITE_NAME,
  generateSEOMetadata: createSeo({
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    // locale: "ru_RU",   // Open Graph locale, defaults to "en_US"
  }).generateSEOMetadata,
};
```

```ts
import { generateSEOMetadata } from "@/lib/siteConfig.js";

export async function generateMetadata() {
  return generateSEOMetadata(seoData, "about", pageData);
}
```

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
untouched — no truncation, no brand suffix. Summaries are trimmed to 160 characters at a
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

```js
module.exports = {
  SITE_URL,
  SITE_NAME,
  generateSEOMetadata: createSeo({
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    canonicalPolicy: "strict-same-origin",   // default "passthrough"
    noIndexPolicy: "strict",                 // default "truthy"
  }).generateSEOMetadata,
};
```

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

### Sitemap fetch failures

`createSitemapNoIndex` now classifies a failed collection query instead of swallowing every
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

## Bilingual sites — `@prismetic/seo-utils/bilingual`

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

`generateSEOMetadata(seoData, path)` takes **two arguments**. There is no `pageData`
fallback chain here — the sites using this entry always have an SEO record or a per-locale
default, so the main entry's Title / Header.Title / PageName ladder would be code no call
site reaches. A third argument is ignored.

Each page gets its locale segment in the canonical, `alternates.languages` (one entry per
locale plus `x-default`), `openGraph.alternateLocale`, the per-locale default title and
description, and an omitted `keywords` key when the CMS value is empty. A path may be
passed with or without its locale prefix — `"dining"`, `"/ar/dining/"` and `"en/dining"`
all resolve to the same page.

A locale that is not in `locales.all` is **clamped to `locales.default` and logged**, never
thrown: `generateMetadata` failing takes the whole build with it.

`forLocale(locale, { available })` narrows the hreflang set to the locales a page was
actually translated into. Omit it and every locale is advertised, which is what the fleet
does today — and why one site currently points an `hreflang="ar"` at a page that does not
exist.

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

## JSON-LD

```tsx
import { JsonLd } from "@prismetic/seo-utils";

<JsonLd seo={seoData} />;
```

Renders each object in the CMS `seo.JSON_LD` field (a JSON string, an object or an
array) as an `application/ld+json` script, and nothing when the field is empty or
invalid. `getStructuredDataScriptInnerHtmls` and the `CmsSeoJsonLd` type are exported for
custom rendering.

## Sitemap noIndex — `next-sitemap.config.js`

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

## Bilingual sitemap — `@prismetic/seo-utils/bilingual/sitemap`

Sites that address Strapi directly and whose routes are localized use this entry instead.
`createSitemapNoIndex` above is untouched.

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

`getNoIndexPathSetPromise()` takes **no argument** here (the redirects-URL version takes the
redirects URL) and caches on the configured base.

`shape` is not cosmetic: a wrong value makes every `seo` read `undefined`, so nothing is
ever excluded and the sitemap ships noIndex pages. The mismatch is detected and logged with
`console.error` — check the postbuild log for `[sitemap] shape is …` before trusting an
export. This entry filters client-side, where `./sitemap` filters in Strapi with
`$eq: true`, because its noIndex rule is broader than that filter and the exclusion set must
match exactly the pages that render a noindex meta tag.

`localeAlternateRefs(siteUrl, path, locales, { xDefault, existsIn })` builds the hreflang
`alternateRefs` for one entry, every href with a trailing slash — with `trailingSlash: true`
an href without one is not the page's canonical and is not in the sitemap's own `<loc>` set,
which is the non-reciprocity condition that makes Google discard the cluster. Pass
`existsIn(locale, restPath)` to stop advertising a translation that was never authored.

**No TLS override.** The package never sets `NODE_TLS_REJECT_UNAUTHORIZED`. A CMS whose
certificate chain Node cannot verify needs an explicit, per-site opt-in in that site's own
config — and only there.

## robots.txt Content-Signal

```js
module.exports = {
  generateRobotsTxt: true,
  robotsTxtOptions: {
    transformRobotsTxt: contentSignalRobotsTxt(),
  },
};
```

Inserts `Content-Signal: search=yes, ai-input=yes, ai-train=no` directly under the
`User-agent: *` group (contentsignals.org: stay in search and AI-assistant answers, let
assistants read pages to answer users, withhold bulk model training). Pass a string to
declare a different signal. A robots.txt without a `User-agent: *` group is returned
unchanged.

## llms.txt

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

Known limitation, kept from the original: a CMS failure is logged and swallowed, so the
build still succeeds but the deploy has no `llms.txt`. Look for
`[llms.txt] generated → out/llms.txt` in the postbuild log before trusting an export.

## Upgrading to 2.1

**Nothing to do.** 2.1 adds two new entry points and changes nothing that an existing site
imports: `src/seo.ts`, `src/sitemap.ts` and `src/index.ts` are byte-identical to 2.0, and
the 109 tests written against 2.0 pass unedited.

Bilingual sites move their `lib/seo.js` and `lib/sitemapNoIndex.js` onto
`@prismetic/seo-utils/bilingual` and `/bilingual/sitemap`. `src/__fixtures__/redsea/` holds
1,080 cases captured from four live bilingual sites that those entries must reproduce.

## Upgrading to 2.0

`createSeo` no longer takes `siteTitle` or `siteDescription`; it takes `siteName` — the
event's name, used as the Open Graph site name and as the last-resort page title. Each
site's `lib/siteConfig.js` swaps its two constants for one `SITE_NAME`, and `app/layout.tsx`
uses it as the root `title` with no root `description`. Delete the
`if (!seo) seo = await fetchHomepageSEO()` fallback in front of every `<JsonLd>`: a page
with no SEO record of its own now renders no JSON-LD rather than the homepage's.

## Development

```bash
npm test -w seo-utils
npm run build -w seo-utils
```

`src/__fixtures__` holds byte-identical copies of the two legacy `lib/seo.js` variants and
of Mosbuild's `lib/generateLlmsTxt.js`; the tests prove the package reproduces them.

# @prismetic/seo-utils

Next.js App Router metadata, JSON-LD and next-sitemap helpers for the Strapi-backed ITE
sites. One implementation replaces the per-repo `lib/seo.js`, `lib/jsonLd.tsx`,
`lib/sitemapNoIndex.js` and (Mosbuild) `lib/generateLlmsTxt.js`; those files are deleted
and the repos use the package directly.

## Install

```bash
pnpm add @prismetic/seo-utils --save-exact   # exact pin, no caret
```

Two entries:

- `@prismetic/seo-utils` — page metadata and JSON-LD (imports React).
- `@prismetic/seo-utils/sitemap` — Node-only helpers for `next-sitemap.config.js`
  (noIndex exclusions, robots.txt Content-Signal, llms.txt). Never bundled.

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

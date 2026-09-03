# @prismetic/seo-utils

Next.js App Router metadata, JSON-LD and sitemap noIndex helpers for the Strapi-backed
ITE sites. One implementation replaces the per-repo `lib/seo.js`, `lib/jsonLd.tsx` and
`lib/sitemapNoIndex.js`; each repo keeps those files as thin shims so no import changes.

## Install

```bash
pnpm add @prismetic/seo-utils   # pin the exact version, no caret
```

## `lib/seo.js`

```js
import { createSeo } from "@prismetic/seo-utils";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "./siteConfig.js";

export const { generateSEOMetadata } = createSeo({
  siteUrl: SITE_URL,
  siteTitle: SITE_TITLE,
  siteDescription: SITE_DESCRIPTION,
  // locale: "ru_RU",   // Open Graph locale, defaults to "en_US"
});
```

`generateSEOMetadata(seoData, path, pageData)` is unchanged for callers. Behaviour is the
upgraded fleet variant: summaries strip HTML tags and the six common entities, a page
with no summary of its own falls back to `Excerpt`, `ShortText`, `Content` and then the
site description, and a record with a `Name` (speakers, partners) uses `Name — Title`
(capped at 60 characters) as its title.

## `lib/jsonLd.tsx`

```ts
export { JsonLd, getStructuredDataScriptInnerHtmls, type CmsSeoJsonLd } from "@prismetic/seo-utils";
```

## `lib/sitemapNoIndex.js`

```js
const { createSitemapNoIndex } = require("@prismetic/seo-utils/sitemap");

module.exports = createSitemapNoIndex();
```

The default checks `pages`, `articles`, `sectors`, `medias` (under `/media-gallery/`) and
`partners`. Sites with other routes pass their own list:

```js
const { DEFAULT_CONTENT_TYPES, createSitemapNoIndex } = require("@prismetic/seo-utils/sitemap");

module.exports = createSitemapNoIndex({
  contentTypes: [
    ...DEFAULT_CONTENT_TYPES,
    { uid: "campaign-pages", field: "PagePath", prefix: "lp" },
  ],
});
```

`next-sitemap.config.js` is CommonJS and this package is ESM. Node 20.19+ / 22.12+
loads it through `require()` natively; older Node versions cannot.

## Development

```bash
npm test -w seo-utils
npm run build -w seo-utils
```

`src/__fixtures__` holds byte-identical copies of the two legacy `lib/seo.js` variants;
the tests prove the package reproduces them.

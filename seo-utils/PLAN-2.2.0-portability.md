# seo-utils 2.3.0 — portability plan

> 2026-09-14: 2.2.0 was used by the description-cap change (`summarise` default 160 → 150),
> so this plan now targets **2.3.0**. Nothing else below has changed.

> **STATUS: PLAN, NOT BUILT.** Written 2026-09-11. Nothing in this document has been
> implemented. `createSeo` today takes no `mapSeo` or `mapPage`, and the package is
> still at 2.2.0. Do not read the code blocks below as a description of current
> behaviour — current behaviour is in [README.md](./README.md).
>
> (The same trap as the old `PROPOSAL-3.0-i18n.md`, which described an API that was
> never built. Step 6 below retires that file.)


## Context

`@prismetic/seo-utils` is published and consumed by 27 ITE sites and 4 Red Sea sites.
An audit of the package (this session) found that **no ITE domain or site name is
hardcoded** in shipped code — the coupling is to *field names*:

- `createSeo`'s `generateSEOMetadata` reads a hardcoded `pageData` chain (`Title`,
  `Header.Title`, `Header.Content`, `PageName`, `Name`, `Company`, `Excerpt`,
  `ShortText`, `Content`) with no override, unlike the sibling
  `@prismetic/article-filters`, which solved the same problem with `ArticleAccessors`.
- Both metadata entries read the Strapi SEO plugin's field names (`metaTitle`,
  `metaDescription`, `canonicalURL`, `metaImage`, …) with no override.

Today a non-ITE project can still use the package by hand-writing a `toSeo(page)`
mapper at every call site. The goal here is to make that mapping a first-class
option so another project can adopt the package without per-site glue.

**Out of scope, decided:** the sitemap helpers and `generateLlmsTxt` keep their
Strapi/ITE coupling. The sitemap gap is *documented*, not closed — see step 4.

## Hard constraint

`src/mainEntryUnchanged.test.ts:20` pins the return shape:

```ts
expect(Object.keys(createSeo(ITE)).sort()).toEqual(["generateSEOMetadata"]);
```

**Nothing may be added to `createSeo`'s return value** — new capability goes into
`SeoConfig` only. Every new option defaults to today's behaviour, so all 280 tests
must pass **unedited**. An edit to an existing test is a design failure, not a test
update.

---

## Step 1 — Extract the pageData chain (`src/seo.ts`)

Move the block at `src/seo.ts:173-210` — everything computing `personTitle`,
`pageTitle`, `personSummary`, `pageSummary` — into a module-level function,
unchanged:

```ts
export interface PageFields { title: string | null; summary: string | null }
export type PageMapper = (pageData: CmsPageData) => PageFields;

/** The ITE fleet's chain. The default, and exported so a consumer can wrap it. */
export const ITE_PAGE_MAPPER: PageMapper = (pageData) => { /* moved verbatim */ };
```

The mapper owns `summarise` entirely (it already calls it for both the 60-char
person title and the 160-char summary). `createSeo` must **not** re-apply
`summarise` to a mapper's output — double-summarising risks moving an ITE byte at
the 160-char boundary, and a custom mapper can import `summarise`, which is already
a public export.

`createSeo` then becomes:

```ts
const { title: pageTitle, summary: pageSummary } = pageMapper(pageData);
// the two lines that consume them at seo.ts:212-218 are unchanged
```

This is the byte-identical-critical step. It is a pure code move.

## Step 2 — Add `mapSeo` and `mapPage` to `SeoConfig` (`src/seo.ts`)

```ts
export interface SeoConfig {
  // …existing fields unchanged…
  /** Normalise any CMS record into the `seo` shape. Default: identity. */
  mapSeo?: (raw: unknown) => CmsSeo;
  /** Derive title and summary from the page record. Default: ITE_PAGE_MAPPER. */
  mapPage?: PageMapper;
}
```

Wire-up inside `createSeo`, two lines:

```ts
const mapSeo = config.mapSeo ?? ((raw) => raw as CmsSeo);
const pageMapper = config.mapPage ?? ITE_PAGE_MAPPER;
```

and one at the top of `generateSEOMetadata`, before any read of `seoData`:

```ts
const seo = mapSeo(seoData);   // then use `seo` throughout in place of `seoData`
```

`mapSeo` must be applied before `parseNoIndex(seoData)` at `seo.ts:221` so a
normalised record is what the noIndex policy sees.

## Step 3 — Mirror `mapSeo` on the bilingual entry (`src/bilingual.ts`)

Add the same optional `mapSeo` to `BilingualSeoConfig`, applied at `bilingual.ts:389`
where `generateSEOMetadata: (seoData, path) => build(...)` is bound. No `mapPage` —
this entry has no `pageData` chain by design (documented in the README).

## Step 4 — Export the currently unreachable symbols (`src/index.ts`)

`dist/index.d.ts` shows these exist in source but are not reachable from `.`:
`CanonicalPolicy`, `NoIndexPolicy`, `SeoRobots`, `parseNoIndex`, `NoIndexVerdict`.
Add them, plus the new `PageFields`, `PageMapper`, `ITE_PAGE_MAPPER`. Pure addition.

## Step 5 — Documentation (`README.md`)

1. **Fix the incorrect sitemap claim.** The `# Portability` section currently says to
   use `./bilingual/sitemap` on any other Strapi. Verified false: `pathForSegments`
   and `pathForRow` (`src/bilingualSitemap.ts:120-131`) unconditionally prefix
   `/${locale}`, so a monolingual site gets `/en/about` and never matches a sitemap
   emitting `/about` — silently, with an empty exclusion set. Replace with an explicit
   statement of the gap: neither sitemap helper serves a monolingual non-ITE site
   (`./sitemap` needs the `<slug>-<uid>` convention, `./bilingual/sitemap` always
   prefixes the locale); write the ~20-line `transform` yourself.
2. Document `mapSeo`, `mapPage`, `ITE_PAGE_MAPPER` in the `# API reference` under
   `createSeo`, and `mapSeo` under `createBilingualSeo`.
3. Replace the hand-rolled `toSeo` recipe in `# Portability` with the built-in
   `mapSeo` form.
4. Update the test count in `# Development` once the new tests land.

## Step 6 — Retire the superseded proposal

`seo-utils/PROPOSAL-3.0-i18n.md` (419 lines) describes work that shipped as 2.1.0;
its banner says so. §1–§8 sketch an API that was deliberately **not** built and read
as a live spec to a new reader.

- Keep the last ~45 lines — "Decisions taken (seo-final-review) — implemented", the
  CMS-probe findings that justify them, and "Observed delta against the goldens"
  (whose numbers `src/redsea.golden.test.ts` pins).
- Move to `seo-utils/docs/adr/2026-09-08-bilingual-entry.md`.
- Fix the stale line 405, which still says "version 3.0.0"; it shipped as 2.1.0.
- Delete the original file.

## Step 7 — Version

`seo-utils/package.json` → **2.3.0**. Additive only; no consumer changes. Consumers
pin with `--save-exact`, so nothing moves until a site bumps deliberately.

---

## Verification

```bash
npm test -w seo-utils          # must be 280 passing, with NO test file edited
npm run build -w seo-utils
npm test --workspaces          # 371 across the monorepo
```

**Regression gate.** The three files that make this safe, none of which may be
touched: `mainEntryUnchanged.test.ts` (11 tests pinning the 2.0 surface, including
the pageData chain and the `Object.keys` shape), `redsea.golden.test.ts` (1,080
captured cases from four live bilingual sites), `seo.test.ts` (26 tests).

**New tests** in a new `src/portability.test.ts`:

| test | asserts |
| --- | --- |
| default `mapSeo` is identity | output equals today's for a plain `CmsSeo` |
| custom `mapSeo` | a WordPress-ish record (`post_title`, `post_excerpt`, `og_image`) produces the right title, description, canonical and OG image |
| `mapSeo` feeds the noIndex policy | `noIndexPolicy:"strict"` + a mapper emitting `metaRobots:"noindex, follow"` → `{index:false, follow:true}` |
| default `mapPage` === `ITE_PAGE_MAPPER` | the person chain (`Name` + `Title` + `Company`) and the `Header.Title` `//` rule still hold |
| custom `mapPage` | non-ITE field names give the title and summary, and `seo.metaTitle` still wins over them |
| `mapPage` returning `{null,null}` | falls back to `siteName`, description omitted |
| new exports reachable from `.` | `parseNoIndex`, `ITE_PAGE_MAPPER` et al. import from the package root |

**End-to-end check** — the non-ITE path this whole change exists for:

```js
const { generateSEOMetadata } = createSeo({
  siteUrl: "https://acme.io",
  siteName: "Acme",
  mapSeo: (p) => ({ metaTitle: p.post_title, metaDescription: p.post_excerpt,
                    metaImage: p.og_image ? { url: p.og_image } : null }),
  mapPage: (p) => ({ title: p?.post_title ?? null, summary: null }),
});
generateSEOMetadata(page, page.slug);
// title "Pricing" · canonical https://acme.io/pricing/ · og image absolutised
```

Confirmed working today via the hand-rolled equivalent; this step only moves the
mapping inside the package.

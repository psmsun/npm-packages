# @prismetic/seo-utils 3.0 — bilingual support (proposal)

> **SUPERSEDED 2026-09-09.** The user chose a separate entry point over extending
> `createSeo`. What shipped is **2.1.0**: `./bilingual` and `./bilingual/sitemap` beside an
> untouched `.` and `./sitemap`, with the strict canonical and noIndex rules always on in
> the bilingual entry rather than behind default-off policy options. The API sketched below
> — `createSeo` growing `locales` / `canonicalPolicy` / `noIndexPolicy`, and version 3.0.0 —
> was **not** built. The reasoning, the decisions, and the observed delta list at the end
> are still the record for why the bilingual entry behaves as it does; read the structure
> as history. Current usage is in README.md.

Status: **proposal, no code written.** For review by `seo-final-review` before implementation.
Author: session `changes-agent-seo-package`, 2026-09-08.

## Why

Four Red Sea sites (turtlebay, daraah, desertrock, shebara) run one SEO implementation
duplicated four times — `lib/seo.(js|ts)`, `lib/jsonLd.(jsx|tsx)`, `lib/sitemapNoIndex.js`,
`next-sitemap.config.js`. Task C proved the duplication is exact: after normalising site
URL and the two default strings, all 280 captured cases are identical **across all four
repos**, not merely within each twin pair. There is one implementation here, and it should
live in the package next to the 27 ITE sites that already share theirs.

The Red Sea layer differs from 2.0 in one structural way — every page exists in `en` and
`ar` — and in several behaviours 2.0 does not have (a canonical sanitizer, a broad noIndex
parser, per-locale defaults, a homepage-inheritance allowlist).

## Hard requirement, restated

**With no locale configuration passed, 3.0 output is byte-identical to 2.0.0 for every ITE
input, and all 109 existing tests pass unchanged.** Baseline confirmed today:
`npm test -w seo-utils` → 5 files, 109 tests, all passing. Everything below that could
move an ITE byte is behind a flag that is **OFF by default**. See [ITE impact](#ite-impact),
whose list is empty by construction.

---

## 1. `createSeo` configuration additions

All new fields optional. Absent ⇒ 2.0 code path.

```ts
export interface SeoConfig {
  siteUrl: string;
  siteName: string;
  /** Open Graph locale for the single-language case. Default "en_US". Unchanged. */
  locale?: string;

  // ---- new in 3.0, all optional ----

  /** Present ⇒ the site is multilingual and URLs carry a locale segment. */
  locales?: {
    /** URL segments in hreflang order, e.g. ["en","ar"]. */
    all: readonly string[];
    /** Segment used for x-default and for unknown locales. e.g. "en". */
    default: string;
    /** URL segment → Open Graph locale. e.g. { en: "en_US", ar: "ar_SA" }. */
    ogLocale?: Record<string, string>;
  };

  /** Per-locale last-resort title/description. Keys are `locales.all` members. */
  defaults?: Record<string, { title?: string; description?: string }>;

  /**
   * Fields `resolvePageSeo` may copy from the homepage when a page has no `seo`.
   * Default [] — nothing is inherited, which is 2.0 behaviour.
   * Red Sea passes ["metaTitle","metaDescription","metaImage"].
   */
  inherit?: readonly string[];

  /** Supplies the homepage `seo` for `resolvePageSeo`. Required iff `inherit` is non-empty. */
  loadHomepageSeo?: (locale: string) => Promise<unknown>;

  /** Canonical validation. Default "passthrough" = 2.0. */
  canonicalPolicy?: "passthrough" | "strict-same-origin";

  /** noIndex interpretation. Default "truthy" = 2.0. */
  noIndexPolicy?: "truthy" | "strict";

  /**
   * Env vars that force noindex on a whole build. Default [] — no env is consulted.
   * Red Sea passes the three it uses today.
   */
  hiddenBuildEnv?: readonly ({ name: string; equals: string })[];
}
```

`hiddenBuildEnv` is a list rather than a boolean because Red Sea's current trio is
site-policy, not package policy: `NODE_ENV=development`, `VERCEL_ENV=preview`,
`NEXT_PUBLIC_ROBOTS_NOINDEX=1`. Red Sea would pass exactly those three and get today's
behaviour; ITE passes nothing and no env is read, so a stray `VERCEL_ENV=preview` in an
ITE CI job cannot start emitting noindex.

## 2. `generateSEOMetadata` signature

ITE's call is `generateSEOMetadata(seoData, path, pageData)` across 27 sites. It must not move.

**Recommendation: a locale-bound generator from `createSeo`.**

```ts
const seo = createSeo({ siteUrl: SITE_URL, siteName: SITE_NAME, locales: {…}, … });

// ITE — unchanged, byte for byte:
export const { generateSEOMetadata } = seo;
generateSEOMetadata(seoData, "about", pageData);

// Red Sea:
const { generateSEOMetadata, resolvePageSeo } = seo.forLocale(locale);
generateSEOMetadata(seoData, "dining");
```

`createSeo` returns `{ generateSEOMetadata, forLocale, resolvePageSeo }`.
`forLocale(locale)` returns `{ generateSEOMetadata, resolvePageSeo }` bound to that locale;
the unbound `generateSEOMetadata` is `forLocale(locales?.default ?? null)`.

Why this over an options object as a 4th argument:

- Red Sea never has a `pageData`. With `(seoData, path, pageData, { locale })` every one of
  its call sites has to pass a placeholder in slot 3 — a positional hole that is easy to
  fill wrongly and impossible to type away.
- The locale is fixed for a whole route render. Binding it once means `resolvePageSeo` and
  `generateSEOMetadata` cannot disagree about which locale they are on; with a per-call
  option they can, and that mismatch is silent.
- The ITE entry point is then literally the 2.0 function, which makes the
  byte-identical requirement structural rather than something tests have to keep proving.

Rejected: overloading argument 2 on whether it looks like a locale (Red Sea's current
`(seoData, locale, path)`). `"en"` is a legal path segment; the disambiguation is a guess.

## 3. Canonical sanitizer

Red Sea's rule, ported as `canonicalPolicy: "strict-same-origin"`:

- Not a string, or blank after trim ⇒ reject.
- Not parseable by `new URL()` ⇒ reject. (This is what catches `/about` and
  `seoteam@acronym.com` — both relative, both indistinguishable from a typo.)
- Protocol not `http:`/`https:` ⇒ reject.
- Host ≠ `siteUrl` host ⇒ reject.
- Otherwise accept.

Rejection falls back to the computed per-path canonical and **logs with `console.error`,
not `console.warn`.** Verified today: `turtlebay/next.config.mjs:16-18` and
`desertrock/next.config.mjs:19-21` set
`removeConsole: { exclude: ["error"] }` in production. Half the fleet therefore strips
`console.warn` from the production bundle — so the sanitizer's warnings, which exist
precisely to make an invisible failure visible, are **not emitted on two of the four sites
today**. daraah and shebara have no `removeConsole` and do log. This is a live defect in the
current implementation, and the port fixes it.

Two open points for you to rule on, both **behaviour changes for Red Sea, not for ITE**:

1. **`http://` on the site's own host is currently accepted.** Golden fixture 11 ships
   `<link rel="canonical" href="http://www.shebara.sa/en/dining/">` on an https-only site,
   with no warning. I propose strict mode reject a scheme that differs from `siteUrl`'s,
   or upgrade it to https and log. Needs your call; it changes Red Sea output if any CMS
   record holds an `http://` canonical.
2. **2.0 has a guard Red Sea lacks.** `seo.ts:203-204` ignores a CMS canonical equal to the
   site root when the path is not the root, because sites that filled every page's SEO from
   the homepage left a root canonical behind. Red Sea has no equivalent: fixture 3 shows a
   valid same-origin canonical accepted on *every* path and locale, so a homepage canonical
   copy-pasted onto `/ar/meetings/enquire-form/` passes, while that page's own hreflang set
   still self-references — exactly the self-contradiction the fleet's own SEO invariants
   forbid. I recommend `strict-same-origin` be a **superset**: same-origin *and* 2.0's
   root-canonical rule. That is strictly safer for both consumers, but it is a Red Sea
   output change and must be validated against the Task B baselines before it lands.

## 4. noIndex parser

Red Sea's, ported as `noIndexPolicy: "strict"`:

`noIndex === true` · `NoIndex === true` · `noIndex === 1` · `noIndex` a string matching
`/^(true|1|yes)$/i` · else `metaRobots|meta_robots|robots|MetaRobots` containing `noindex`.

2.0's rule is `seoData?.noIndex ?? false` used as a truthy test. The two disagree in both
directions:

| CMS value | 2.0 | strict |
|---|---|---|
| `true` / `1` / `"yes"` | noindex | noindex |
| `"false"` | **noindex** | index |
| `"no"`, `"0"`, `""` | `""`→index, others **noindex** | index |
| `metaRobots: "noindex, follow"` | index | noindex |

So strict mode both fixes a latent 2.0 bug (a string `"false"` currently de-indexes the
page) and starts honouring `metaRobots`. Either direction can move an ITE page.

**Default `"truthy"` (OFF).** Flipping the default to `"strict"` **requires an ITE CMS audit
showing zero affected pages** — every `seo.noIndex` across the 27 sites is a boolean or
absent, and no `metaRobots` field is populated. That audit is out of scope here and belongs
to an ITE-scoped session.

One note if strict lands: it discards the `follow` in `"noindex, follow"` and emits
`noindex, nofollow`. Red Sea does this today (golden fixture 16). Worth fixing in the port,
but it is a Red Sea output change.

## 5. metaImage resolution

Order: flat `metaImage.url` → `metaImage.data.attributes.url` →
`metaImage.data.attributes.formats.large.url`. Relative values get `siteUrl` prefixed;
anything starting `http` passes through.

**This is provably zero-impact for ITE and needs no CMS audit**, from the code alone: the
extra branches are only reachable when `metaImage.data` exists. For any input where it does
not — which is every input 2.0's `CmsSeo` type can express — `data.attributes` is
`undefined`, the nested lookups yield `undefined`, and the result is the flat `.url`, i.e.
2.0's answer. So it can be default ON with an empty ITE-impact entry.

One deliberate deviation from the Red Sea source: Red Sea evaluates **nested first**
(`nestedUrl ?? flatUrl`). I propose **flat first**, matching 2.0. The two differ only for a
record carrying both a flat `.url` and a `data.attributes.url`, which cannot occur on any
current consumer — the Red Sea v5 sites (turtlebay, daraah) never have `.data`, the v4 sites
(desertrock, shebara) never have flat `.url`, and ITE never has `.data`. The Task C goldens
do **not** cover the both-present case; 3.0 should add a test that pins flat-first.

## 6. `./sitemap`

```ts
createSitemapNoIndex(options?: {
  // ---- 2.0 preset: omit everything and behaviour is unchanged ----
  contentTypes?: readonly SitemapContentType[];
  fetch?: FetchLike;

  // ---- new: explicit-base mode (Red Sea) ----
  apiBase?: string;
  shape?: "v4" | "v5";
  locales?: readonly string[];
  singleTypes?: readonly { uid: string; segments: string[] }[];
  collections?: readonly { uid: string; field: string; prefix?: string }[];
  extraPathsEnv?: string;   // env var holding comma-separated extra paths
})
```

- **No arguments ⇒ exactly 2.0.** The redirects-URL convention stays as the default preset:
  `getNoIndexPathSetPromise(redirectsUrl)` derives `{apiBase, slugPrefix}` from the
  `*-redirects` URL, queries `filters[seo][noIndex][$eq]=true`, and caches per URL.
- With `apiBase` set, `getNoIndexPathSetPromise()` takes no argument (Red Sea's shape) and
  caches on `apiBase + extraPaths`. Passing an argument in that mode is ignored.
- `shape` selects row unwrapping (`row.attributes` vs flat) and the populate syntax
  (`populate[seo]=true` vs `populate[0]=seo`). **Keep the mismatch guard**: it is the one
  thing standing between a wrong constant and a silently empty exclusion set. Verified
  today on all four repos — correct shape passes with 0 errors, wrong shape yields an empty
  set plus 4 (v5 sites) or 18 (v4 sites) `[sitemap] CMS_SHAPE …` errors on stderr.
- 2.0 filters server-side (`filters[seo][noIndex][$eq]=true`); Red Sea fetches all rows and
  filters in JS because its noIndex parser is broader than `$eq: true`. Explicit-base mode
  keeps the client-side filter. Worth a line in the README: it is the reason the two modes
  do not share a query builder.

New export for the `transform` hook:

```ts
localeAlternateRefs(siteUrl: string, path: string, locales: readonly string[]):
  Array<{ href: string; hreflang: string; hrefIsAbsolute: true }>
```

Emits one entry per locale plus `x-default` at `locales[0]`, every `href` with a trailing
slash — the four repos' `transform` bodies are byte-identical and reduce to one call.

Two things it must **not** paper over, both surfaced by Task B:

- The helper emits an alternate for every locale unconditionally. desertrock's
  `/ar/saudi-national-day-2025/` is emitted as an `ar` alternate today although no such page
  exists and it is not in the `<loc>` set — the fleet's one non-reciprocal alternate.
  3.0 should accept an optional `existsIn?: (locale, path) => boolean` so a site can suppress
  a missing translation; without it the helper reproduces the current bug faithfully.
- **`process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` must not exist in the package.** All
  four Red Sea `sitemapNoIndex.js` set it unconditionally at module load, and three of them
  point at *production* CMSes that do not need it — the build log shows the Node warning on
  every one. In 3.0 it belongs in the consuming site's config, set explicitly and only by
  daraah, whose CMS is UAT.

## 7. `resolvePageSeo`

```ts
resolvePageSeo(pageSeo: unknown, locale?: string): Promise<Record<string, unknown> | undefined>
```

Returns `pageSeo` untouched when it is an object; otherwise calls `loadHomepageSeo(locale)`
and copies only the `inherit` allowlist, returning `undefined` when nothing survives.
`inherit: []` (the default) makes the homepage loader unreachable, so ITE keeps 2.0's
"nothing is ever inherited".

Behaviour to preserve, and one to question: a page `seo` of `{}` short-circuits — the
homepage loader is never called and `{}` is returned (golden inheritance cases). An empty
`seo` component from Strapi therefore blocks inheritance completely. That is defensible but
almost certainly not what an editor means, and it should be an explicit decision in 3.0
rather than a consequence of `typeof x === "object"`.

## 8. Locale handling details

- Unknown locale (goldens use `"fr"`): titles and og fall back to the default locale, **but
  the canonical is still `${siteUrl}/fr/${path}/`** and `languages` lists only the configured
  locales — a canonical for a page that cannot exist. 3.0 should either reject an
  unconfigured locale loudly or clamp the URL to `locales.default`. Current behaviour is a
  silent wrong URL; either replacement is better.
- Path locale-stripping: the current code strips a leading segment only when it equals the
  *current* locale, so `("ar", "en/dining")` yields `/ar/en/dining/`. 3.0 should strip any
  member of `locales.all`, which is what every call site means. This is a Red Sea output
  change only if a call site passes a locale-prefixed path for the other locale — none of
  the four do today, so the goldens will not move.
- `alternates.languages` gets one entry per locale plus `x-default` → `locales.default`,
  each with a trailing slash, matching `trailingSlash: true`.
- Blank strings: 3.0 should use 2.0's `firstNonBlank` everywhere. Red Sea's `||` accepts
  `metaTitle: "   "` and ships a blank `<title>` (golden fixture 18). Adopting
  `firstNonBlank` **cannot change ITE output** — it is already 2.0's behaviour — and fixes
  Red Sea. This is the one place the two implementations disagree where the package is
  already right.

## ITE impact

Behavioural differences between 2.0.0 and 3.0 **at default configuration**:

> *(none)*

Every change above is reached only through a config field ITE does not pass:

| Change | Gate | Default |
|---|---|---|
| per-locale defaults, hreflang set, locale URL segment | `locales` absent | off |
| homepage inheritance | `inherit: []` | off |
| strict canonical sanitizer | `canonicalPolicy` | `"passthrough"` (2.0) |
| broad noIndex parser | `noIndexPolicy` | `"truthy"` (2.0) |
| hidden-build env noindex | `hiddenBuildEnv: []` | off |
| v4/nested metaImage | none — provably unreachable without `metaImage.data` | on |
| explicit-base sitemap mode | `apiBase` absent | off |

Candidates for a later default flip, each **requiring an ITE CMS audit showing zero affected
pages** (out of scope here, ITE-scoped session):

- `noIndexPolicy: "strict"` — fixes `"false"` currently de-indexing a page; starts honouring
  `metaRobots`. Audit: every `seo.noIndex` boolean-or-absent, no `metaRobots` populated.
- `canonicalPolicy: "strict-same-origin"` — would begin rejecting relative and off-site CMS
  canonicals that 2.0 passes through. Audit: every `seo.canonicalURL` absolute and
  same-origin. Note the ITE sites are single-origin, so an off-site canonical is likelier
  here to be deliberate than it is on Red Sea.

## Test plan

1. **ITE regression.** `src/__fixtures__` and the 5 existing test files unchanged; the
   109-test baseline must stay green with no edits. Any diff to an existing test is a
   design failure, not a test update.
2. **Red Sea goldens.** `red sea/scratch/seo-package/goldens/*.golden.json` — 4 files,
   280 cases each — become vitest fixtures. Each repo's site constants are fed to
   `createSeo`, and the 3.0 output must equal the golden for every case, console lines
   included. Cases known to move (§3.1, §3.2, §4 follow-flag, §8 unknown locale, §8 blank
   title) get an explicit expected-delta list reviewed before they are re-baselined —
   never a silent golden refresh.
3. **New unit tests** for the gaps the goldens do not cover: `metaImage` with both flat and
   nested URLs present (pins flat-first); `localeAlternateRefs` with `existsIn`;
   `createSitemapNoIndex` shape-mismatch guard in both directions; `hiddenBuildEnv` with an
   env set and unset.
4. **Migration acceptance.** For each Red Sea repo: `rm -rf .next out`, production build,
   then `diff -r` of `out/**/*.html` `<head>` and `sitemap.xml` against
   `scratch/seo-package/<repo>-baseline-out/`. Target is byte-identical except the reviewed
   delta list. Re-run `tools/measure.py` and compare — **including the third-party script
   row**, since daraah's baseline has no GTM at all and must still have none.
   `tsc --noEmit` clean on desertrock and shebara.
5. **Counterfactual.** Before trusting any of the above, revert one change and confirm the
   corresponding measurement moves. `tools/measure.py` shipped a hreflang regex that
   reported 0 for all 125 pages of the fleet; the check that would have caught the
   migration breaking hreflang could not have failed.

## Versioning

**3.0.0.** Nothing here is breaking for ITE — the default path is 2.0 by construction and
the 109 tests pass unedited — so 2.1.0 would be defensible. Major is still the right call:
`createSeo`'s return type grows `forLocale` and `resolvePageSeo`, `createSitemapNoIndex`
gains a second operating mode whose `getNoIndexPathSetPromise` has a different arity, and
consumers pin exact versions anyway (`--save-exact`, no caret). A major makes the ITE
upgrade a deliberate act rather than something a lockfile refresh does quietly.

**Prerequisite, already applied.** The package is ESM and `next-sitemap.config.js` loads it
via `require(esm)`, which needs Node ≥20.19 or ≥22.12. shebara's pipeline pinned 20.12.2;
that is now 22.22.0 with `engines.node` at `>=22.12.0` (uncommitted, task A). turtlebay and
daraah are on 22.21.1 and desertrock on 22.22.0, all fine.

## Decisions taken (seo-final-review, 2026-09-08) — implemented

A read-only probe of all four live CMSes (both locales, single types and collections) found
every `canonicalURL` to be null, an https self-referencing same-origin URL, or the two
`seoteam@acronym.com` entries; zero `http://`, zero root-canonical-on-subpath, zero blank
`metaTitle`, `noIndex` only true/false/null, and no `metaRobots` field on the SEO component
at all. All six decisions below are therefore **zero-impact on live Red Sea output**; they
move synthetic fixtures only.

1. **http:// canonical** — rejected when the scheme differs from `siteUrl`'s, logged with
   `console.error`, falls back to the computed canonical. Never silently upgraded.
2. **`strict-same-origin` is a superset** — same scheme + host, plus the root-canonical rule.
   Implemented for the site root *and* the locale home (`/en/`), since on a bilingual site
   the locale home is the real homepage and the bare apex serves nothing.
3. **`metaRobots: "noindex, follow"`** keeps `follow: true`; a boolean/`1`/`"yes"` noIndex
   still means nofollow.
4. **A page `seo` of `{}`** keeps today's behaviour — used as-is, no inheritance. Documented
   in the README and in `resolveFor`'s docblock as an open content-team question.
5. **Unknown locale** — clamped to `locales.default` and logged with `console.error`. Never
   thrown: `generateMetadata` failing takes the build with it. Any configured locale prefix
   is stripped from the path, and `firstNonBlank` is used throughout.
6. **JsonLd** — no behavioural change; `jsonLdEquivalence.test.ts` pins it against a
   byte-identical copy of shebara's component across 48 cases.

Also implemented as proposed: `forLocale(locale)` binding, with the optional
`{ available }` narrowing for hreflang; `canonicalPolicy` / `noIndexPolicy` / `inherit` /
`loadHomepageSeo` / `hiddenBuildEnv`, all default-off; metaImage flat-first, default-on,
with the both-shapes-present pin test; sitemap explicit-base mode with the shape guard and
an `existsIn` hook; no TLS override anywhere in the package; `console.error` for sanitizer
logs; version 3.0.0.

### Observed delta against the goldens

150 of each repo's 270 cases are in the delta list; **147 move, 3 do not**, and the other
120 are byte-identical. The three that do not move are fixture 3 on locale `fr` at the
non-prefixed paths: its CMS canonical is valid and survives, so the locale clamp has
nothing left to change. `redsea.golden.test.ts` pins all of these numbers — a widening
delta predicate makes the test fail rather than pass vacuously.

Delta reasons, each proven to move at least one case: http canonical rejected (fixture 11),
follow preserved (16), blank title falls back (18), unknown locale clamped (`fr`), locale
prefix stripped (`("ar","en/dining")` and `("en","/ar/dining/")`). Sanitizer log lines also
move from `console.warn` to `console.error`; the message text is unchanged, and the golden
test compares message text while asserting the channel separately.

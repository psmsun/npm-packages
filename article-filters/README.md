# @prismetic/article-filters

> Built for Prismetic's ITE Strapi-backed Next.js sites. Examples assume that
> content shape; the filtering core is generic and takes accessors for any other.

Topic / year / sort filtering for CMS article lists.

Three layers, usable independently:

| Layer | Export | What it is |
| --- | --- | --- |
| Pure | `filterArticles`, `sortArticles`, `derive*`, `parse*`/`build*` | No React, no DOM. Plain functions over an array of articles. |
| State | `useArticleFilters` | All state, derivation and URL sync. No markup, no design. Used by every site including the MUI ones. |
| UI | `ArticleFilterBar` | The shadcn/Radix control row. Every class is a prop; shared defaults ship as plain CSS. |

A site can take all three, take the hook and render its own bar, or take only
the pure functions and own everything above them.

## Install

```bash
npm install @prismetic/article-filters
```

Then import the defaults once, next to your other global styles:

```css
/* globals.css */
@import "@prismetic/article-filters/styles.css";
```

There is deliberately **no `@source` directive to add**. The defaults are plain
CSS, so Tailwind never has to scan this package — which matters because
`node_modules/@prismetic/*` is a pnpm symlink locally but a real directory
under Azure's `npm install`, and a `@source` path that resolves in one can
emit nothing in the other.

The stylesheet is optional. Without it the bar renders unstyled but fully
functional; with it you get layout, the popover panel and the checkbox.

Every rule sits in **`@layer components`**. Tailwind v4 emits utilities in
`@layer utilities`, and an unlayered stylesheet beats any layered rule
regardless of specificity — so without the layer, a `classNames` utility on a
property the defaults already set (trigger font, panel background, …) would be
silently dead. `@import "tailwindcss"` declares the layer order first, so the
package rules land below utilities with no extra syntax on the import.

## Requirements

| | |
| --- | --- |
| Peer | `react >=18` — accurate as declared; nothing here uses a React 19-only API |
| Runtime deps | `@radix-ui/react-checkbox`, `@radix-ui/react-popover` (installed for you) |
| Next.js | **not** a peer dependency — this package never imports from `next` |
| `"use client"` | already in the source of `useArticleFilters` and `ArticleFilterBar`; you do not add it |
| Tested against | React 19 / Next 16 |

`filters.ts` is pure and has no React import at all, so the pure layer is safe
to call from a server component or a build script.

## Quick start

```tsx
import {
  ArticleFilterBar,
  useArticleFilters,
} from "@prismetic/article-filters";

const filters = useArticleFilters(articles);

return (
  <>
    <ArticleFilterBar
      topicOptions={filters.topicOptions}
      yearOptions={filters.yearOptions}
      selectedTopics={filters.selectedTopics}
      selectedYear={filters.selectedYear}
      sort={filters.sort}
      onToggleTopic={filters.toggleTopic}
      onClearTopics={filters.clearTopics}
      onYearChange={filters.setYear}
      onSortChange={filters.setSort}
    >
      <button
        type="button"
        disabled={!filters.canReset}
        onClick={filters.resetAll}
      >
        Reset filters
      </button>
    </ArticleFilterBar>
    {filters.articles.map((article) => (
      <Card key={article.id} {...article} />
    ))}
  </>
);
```

`filters.articles` is the filtered **and** sorted list. You render that, not the
array you passed in. Children render last in the bar's row — pass the site's own
Button there for a Reset control.

### Real-world usage

With site classes, pagination reset and non-default field names:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  ArticleFilterBar,
  useArticleFilters,
} from "@prismetic/article-filters";

const PAGE_SIZE = 12;

const ArticleList = ({ articles }) => {
  const filters = useArticleFilters(articles, {
    getTitle: (a) => a.Heading,
    getTags: (a) => a.Categories,
  });

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Any change to the result set drops the reader back to page one.
  const { signature } = filters;
  useEffect(() => setVisibleCount(PAGE_SIZE), [signature]);

  return (
    <>
      <ArticleFilterBar
        topicOptions={filters.topicOptions}
        yearOptions={filters.yearOptions}
        selectedTopics={filters.selectedTopics}
        selectedYear={filters.selectedYear}
        sort={filters.sort}
        onToggleTopic={filters.toggleTopic}
        onClearTopics={filters.clearTopics}
        onYearChange={filters.setYear}
        onSortChange={filters.setSort}
        classNames={{ trigger: "title-30 font-bebas", clear: "text-mainColor2" }}
      />

      {filters.articles.slice(0, visibleCount).map((article) => (
        <Card key={article.id} {...article} />
      ))}

      {visibleCount < filters.articles.length && (
        <button onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
          Load more
        </button>
      )}
    </>
  );
};
```

## API reference

### `useArticleFilters(source, options?)`

```ts
useArticleFilters<T>(
  source: readonly T[],
  options?: UseArticleFiltersOptions<T>,
): UseArticleFiltersResult<T>
```

| param | type | |
| --- | --- | --- |
| `source` | `readonly T[]` | the full, unfiltered article list |
| `options` | `UseArticleFiltersOptions<T>` | accessor overrides plus `syncUrl` |

`options` is `ArticleAccessors<T>` with one extra key:

| option | type | default | |
| --- | --- | --- | --- |
| `syncUrl` | `boolean` | `true` | read filters from the query string on mount and write them back on change |
| `getId` | `(a: T) => string \| number \| null \| undefined` | `a.id` | used only as a stable tie-break in date sorts |
| `getTitle` | `(a: T) => string \| null \| undefined` | `a.Title` | used by `sort: "title"` |
| `getDate` | `(a: T) => string \| null \| undefined` | `a.PublishedDate` | must be `YYYY-MM-DD`-prefixed |
| `getTags` | `(a: T) => ReadonlyArray<{ Name?: string \| null } \| string> \| null \| undefined` | `a.Tags` | tags may be objects **or** plain strings |

Returns `UseArticleFiltersResult<T>`:

| field | type | |
| --- | --- | --- |
| `articles` | `T[]` | filtered **and** sorted — render this |
| `topicOptions` | `TopicOption[]` | `{ slug, name, count }`, alphabetical, counts scoped to the selected year |
| `yearOptions` | `string[]` | distinct years, newest first |
| `selectedTopics` | `string[]` | selected topic **slugs** |
| `selectedYear` | `string` | `""` means all years |
| `sort` | `SortKey` | `"newest" \| "oldest" \| "title"` |
| `setTopics` | `(slugs: string[]) => void` | replace the whole selection |
| `toggleTopic` | `(slug: string) => void` | add or remove one |
| `clearTopics` | `() => void` | clear topics only |
| `setYear` | `(year: string) => void` | `""` clears |
| `setSort` | `(sort: SortKey) => void` | |
| `resetAll` | `() => void` | topics, year and sort back to defaults |
| `isFiltered` | `boolean` | true when a topic or year is active — **sort is not counted** |
| `canReset` | `boolean` | true when anything differs from the defaults, **sort included** — drives a Reset button |
| `signature` | `string` | changes whenever the result set changes; use as a `useEffect` dep to reset pagination |

```tsx
const filters = useArticleFilters(articles, { syncUrl: false });
```

> **Accessors are captured on first render.** They are held in a `useRef` so
> inline arrow functions don't re-run every derivation on every render. A
> consequence: changing an accessor after mount has no effect. Accessors are
> expected to be structural, not reactive.

---

### `<ArticleFilterBar />`

The presentational control row. Holds no filter state of its own — every value
comes in as a prop and every change goes out as a callback, which is what lets
the MUI sites reuse the hook without this component.

| prop | type | default | |
| --- | --- | --- | --- |
| `topicOptions` | `TopicOption[]` | — | from `filters.topicOptions` |
| `yearOptions` | `string[]` | — | from `filters.yearOptions` |
| `selectedTopics` | `string[]` | — | slugs |
| `selectedYear` | `string` | — | `""` for all |
| `sort` | `SortKey` | — | |
| `onToggleTopic` | `(slug: string) => void` | — | |
| `onClearTopics` | `() => void` | — | |
| `onYearChange` | `(year: string) => void` | — | |
| `onSortChange` | `(sort: SortKey) => void` | — | |
| `classNames` | `ArticleFilterBarClassNames` | `{}` | merged **after** the BEM defaults |
| `labels` | `ArticleFilterBarLabels` | English | per-key override, see below |
| `sortOptions` | `{ value: SortKey; label: string }[]` | `SORT_OPTIONS` | site-specific or translated sort wording |
| `children` | `ReactNode` | — | rendered last in the row, after Sort, with no wrapper — e.g. a Reset button |

**`classNames` keys** — each maps onto the BEM class it sits beside:

| key | element | default class |
| --- | --- | --- |
| `root` | the bar | `article-filter-bar` |
| `control` | one control wrapper | `article-filter-bar__control` |
| `trigger` | the button that opens a panel | `article-filter-bar__trigger` |
| `triggerLabel` | text inside the trigger | `article-filter-bar__trigger-label` |
| `triggerIcon` | the chevron | `article-filter-bar__icon` |
| `panel` | the popover content | `article-filter-bar__panel` |
| `option` | one row in a panel | `article-filter-bar__option` |
| `optionLabel` | that row's text | `article-filter-bar__option-label` |
| `count` | the facet count | `article-filter-bar__count` |
| `checkbox` | the Radix checkbox | `article-filter-bar__checkbox` |
| `clear` | the Clear button | `article-filter-bar__clear` |

Your class is appended, so a Tailwind utility overrides the default without
`!important` as long as it wins on specificity.

**`labels` keys** — all optional, merged over the English defaults:

| key | type | default |
| --- | --- | --- |
| `allTopics` | `string` | `"All topics"` |
| `allYears` | `string` | `"All years"` |
| `clear` | `string` | `"Clear"` |
| `topicsSelected` | `(count: number) => string` | ``(n) => `${n} topics` `` |
| `topicsAriaLabel` | `string` | `"Filter articles by topic"` |
| `yearsAriaLabel` | `string` | `"Filter articles by year"` |
| `sortAriaLabel` | `string` | `"Sort articles"` |

```tsx
<ArticleFilterBar
  {...props}
  labels={{
    allTopics: "Все темы",
    allYears: "Все годы",
    clear: "Сбросить",
    topicsSelected: (n) => `Выбрано: ${n}`,
  }}
  sortOptions={[
    { value: "newest", label: "Сначала новые" },
    { value: "oldest", label: "Сначала старые" },
    { value: "title", label: "По названию" },
  ]}
/>
```

**Accessibility.** Each panel is a `role="listbox"` labelled by its trigger, and
each row a `role="option"` carrying `aria-selected`. Arrow Up / Arrow Down move
focus between rows, Home and End jump to the ends, and focus is deliberately
*not* pulled into the panel on open — the trigger keeps it so the label stays
announced. The checkbox is `aria-hidden` because the row it sits in already
reports selection.

---

### Accessors

#### `defaultAccessors()`

```ts
defaultAccessors<T>(): Required<ArticleAccessors<T>>
```

The fleet's dominant Strapi shape: `id`, `Title`, `PublishedDate`, `Tags[].Name`.
Takes no arguments — it returns a fresh object each call.

#### `resolveAccessors(overrides?)`

```ts
resolveAccessors<T>(overrides?: ArticleAccessors<T>): Required<ArticleAccessors<T>>
```

Fills any gaps in `overrides` from `defaultAccessors()`. **Every pure function
below takes the resolved form**, so this is the first call when using the pure
layer directly:

```ts
const acc = resolveAccessors<Article>({ getTitle: (a) => a.Heading });
filterArticles(articles, ["dairy"], "", acc);
```

---

### Derivation

#### `slugifyTopic(name)`

```ts
slugifyTopic(name: string): string
```

Trims, lowercases, and collapses every run of non-alphanumerics to a single
dash, with leading and trailing dashes stripped. Latin and Cyrillic are kept;
the character class is written as explicit ranges rather than `\p{L}` so the
output is identical under every repo's `tsconfig` target.

```ts
slugifyTopic("Grocery ");             // "grocery"
slugifyTopic("Tea, Coffee & Cacao");  // "tea-coffee-cacao"
slugifyTopic("Молочная продукция");   // "молочная-продукция"
slugifyTopic("  —  ");                // "" — nothing sluggable
```

#### `articleYear(article, accessors)`

```ts
articleYear<T>(article: T, accessors: Required<ArticleAccessors<T>>): string
```

The first four characters of `getDate(article)`, or `""`. Returns a string, not
a number. For an ISO datetime (`2025-01-01T03:30:00.000Z`) that is the UTC year.

#### `articleTopicSlugs(article, accessors)`

```ts
articleTopicSlugs<T>(article: T, accessors: Required<ArticleAccessors<T>>): string[]
```

Every tag on one article, slugified, with empties dropped. Handles tags given as
`{ Name }` objects or as plain strings.

#### `deriveTopicNames(articles, accessors)`

```ts
deriveTopicNames<T>(
  articles: readonly T[],
  accessors: Required<ArticleAccessors<T>>,
): { slug: string; name: string }[]
```

Every distinct tag across the corpus, **alphabetical** by name. Two names that
slug identically merge and the first one encountered wins the display name.

```ts
deriveTopicNames(articles, acc);
// [{ slug: "baking", name: "Baking" },
//  { slug: "cheese", name: "Cheese" },
//  { slug: "seafood", name: "Seafood" }]

// "Grocery " and "Grocery" both slug to "grocery":
// [{ slug: "grocery", name: "Grocery" }]
```

#### `deriveYears(articles, accessors)`

```ts
deriveYears<T>(
  articles: readonly T[],
  accessors: Required<ArticleAccessors<T>>,
): string[]
```

Distinct years, deduplicated, **newest first**.

```ts
deriveYears(articles, acc); // ["2026", "2024"]
```

#### `deriveTopicOptions(articles, topicNames, selectedYear, accessors)`

```ts
deriveTopicOptions<T>(
  articles: readonly T[],
  topicNames: { slug: string; name: string }[],
  selectedYear: string,
  accessors: Required<ArticleAccessors<T>>,
): TopicOption[]
```

Attaches a live facet count to each topic. Counts honour `selectedYear` but
ignore the topic selection. Every topic stays in the list even at count `0`, so
the panel never changes length.

```ts
const names = deriveTopicNames(articles, acc);

deriveTopicOptions(articles, names, "", acc);
// [{ slug: "cheese", name: "Cheese", count: 2 },
//  { slug: "dairy",  name: "Dairy",  count: 2 }]

deriveTopicOptions(articles, names, "2026", acc);
// [{ slug: "cheese", ..., count: 0 },
//  { slug: "dairy",  ..., count: 1 }]
```

---

### Filtering and sorting

#### `filterArticles(articles, selectedTopics, selectedYear, accessors)`

```ts
filterArticles<T>(
  articles: readonly T[],
  selectedTopics: readonly string[],
  selectedYear: string,
  accessors: Required<ArticleAccessors<T>>,
): T[]
```

| param | | |
| --- | --- | --- |
| `selectedTopics` | `readonly string[]` | **slugs**, not names; `[]` means no topic filter |
| `selectedYear` | `string` | `""` means no year filter |

Topics union, the year intersects. Returns a new array.

```ts
filterArticles(articles, [], "", acc);                  // everything
filterArticles(articles, ["dairy", "cheese"], "", acc); // Dairy OR Cheese
filterArticles(articles, ["dairy", "cheese"], "2025", acc); // (Dairy OR Cheese) AND 2025
```

Once any topic is selected, untagged articles drop out.

#### `sortArticles(articles, sort, accessors)`

```ts
sortArticles<T>(
  articles: readonly T[],
  sort: SortKey,
  accessors: Required<ArticleAccessors<T>>,
): T[]
```

Returns a new array; **does not mutate its input**.

| `sort` | order |
| --- | --- |
| `"newest"` | `getDate` descending, then `getId` ascending as a stable tie-break |
| `"oldest"` | `getDate` ascending, same tie-break — so same-day articles keep one fixed order in both directions |
| `"title"` | `getTitle` via `localeCompare` with `numeric: true` and `sensitivity: "base"` — case-insensitive, and `Item 2` before `Item 10` |

```ts
// ids "10" and "2" share 2026-07-27; "7" is 2024-01-01
sortArticles(articles, "newest", acc).map((a) => a.id); // ["2", "10", "7"]
sortArticles(articles, "oldest", acc).map((a) => a.id); // ["7", "2", "10"]
sortArticles(articles, "title",  acc).map((a) => a.Title); // ["apple", "Mango", "Zebra"]
```

---

### URL state

#### `parseFilterParams(search, knownTopics, knownYears)`

```ts
parseFilterParams(
  search: string,
  knownTopics: readonly string[],
  knownYears: readonly string[],
): Partial<FilterState>
```

Reads `?topics=a,b&year=2025&sort=title`. Returns a **`Partial`** — a key is
present only when the URL carried a value that survived validation, so the
result can be spread over current state without clobbering it.

Values absent from the current data are dropped rather than applied, which is
what stops a stale shared link from rendering an empty list.

```ts
parseFilterParams("?topics=dairy,gone", topics, years).topics; // ["dairy"]
parseFilterParams("?year=1999", topics, years).year;           // undefined
parseFilterParams("?sort=bogus", topics, years).sort;          // undefined
parseFilterParams("?sort=title", topics, years).sort;          // "title"
parseFilterParams("", topics, years);                          // {}
```

#### `buildFilterSearch(search, state)`

```ts
buildFilterSearch(search: string, state: FilterState): string
```

Takes the **current** query string and returns a new one with the filter params
brought in line with `state`. Defaults write no param, and unrelated params are
preserved. Returns `""` (not `"?"`) when nothing is left.

```ts
buildFilterSearch("", { topics: [], year: "", sort: "newest" });
// ""

buildFilterSearch("", { topics: ["dairy", "cheese"], year: "2025", sort: "oldest" });
// "?topics=dairy%2Ccheese&year=2025&sort=oldest"

buildFilterSearch("?utm_source=x", { topics: ["dairy"], year: "", sort: "newest" });
// "?utm_source=x&topics=dairy"

buildFilterSearch("?topics=dairy&year=2025", { topics: [], year: "", sort: "newest" });
// ""
```

The comma between slugs is percent-encoded to `%2C` by `URLSearchParams`;
`parseFilterParams` decodes it back.

#### `canResetFilters(state)`

```ts
canResetFilters(state: FilterState): boolean
```

True when topics, year **or sort** differ from the defaults. The hook exposes it
as `canReset`.

```ts
canResetFilters({ topics: [], year: "", sort: "newest" }); // false
canResetFilters({ topics: [], year: "", sort: "oldest" }); // true
```

---

### Constants

#### `SORT_OPTIONS`

```ts
const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title",  label: "Title A–Z" },
];
```

The default for `ArticleFilterBar`'s `sortOptions` prop. Pass your own for
translated wording rather than mutating this array.

#### `DEFAULT_SORT`

```ts
const DEFAULT_SORT: SortKey = "newest";
```

The initial sort, and the value `buildFilterSearch` treats as "write no param".

---

### Type exports

`SortKey` · `SortOption` · `TopicOption` · `ArticleAccessors<T>` · `FilterState` ·
`UseArticleFiltersOptions<T>` · `UseArticleFiltersResult<T>` ·
`ArticleFilterBarProps` · `ArticleFilterBarClassNames` · `ArticleFilterBarLabels`

Each is expanded in the table of the function or component that consumes it.
`FilterState` is the only one not shown above:

```ts
interface FilterState {
  topics: string[];
  year: string;
  sort: SortKey;
}
```

Note that `parseFilterParams` returns `Partial<FilterState>` while
`buildFilterSearch` requires a complete one.

## Behaviour

- Multiple topics **union** (Dairy OR Cheese); the year **intersects**.
- Topic counts are live facets: they honour the selected year but ignore the
  topic selection, so ticking a box never collapses the other counts to zero.
- Topics are listed **alphabetically**, not by count, so the panel does not
  reshuffle when the year changes.
- A control with fewer than 2 options renders nothing. Sort always renders.
- The trigger label reflects the selection — `All topics` → `Dairy` →
  `2 topics` — so an active filter is visible once the panel closes.
- URL state is written with `history.replaceState`, defaults omitted. Unrelated
  params (utm tags) are preserved. Values absent from the current data are
  dropped on read rather than applied.
- The year is sliced off the ISO date or datetime string (`2025-01-01` or
  `2025-01-01T03:30:00.000Z` — the UTC year), not read through `new Date()`,
  which would shift it by the viewer's timezone.

### Why the URL is read in an effect, not during render

The incoming query string is applied after mount, behind a ref that fires once.
Applying it during render would make the first client paint diverge from the
statically exported HTML, and the write-back effect is guarded on the same ref
so it cannot erase the incoming link before it has been read.

`replaceState` rather than `pushState`: a static export has no server to hand a
new URL to, and pushing an entry per click would make Back walk the filter
history instead of leaving the page.

### Why the panel is a non-modal Popover

Radix's modal scroll lock pads `<body>` to compensate for a scrollbar it
removes. These sites scroll on `<html>` (their `globals.css` puts `overflow-x`
on `body`), so the scrollbar never goes away and the compensation lands as a
pure width change — shifting the centred container sideways every time a panel
opens. Non-modal avoids the whole class of bug. The MUI bar needs
`disableScrollLock: true` for the same reason.

The panel uses `updatePositionStrategy="always"`: GSAP ScrollSmoother keeps
moving the trigger by transform after scroll events stop, which Radix's default
`"optimized"` strategy misses. The rAF loop runs only while a panel is open.

## Limits

- **Renaming a tag in Strapi changes its slug and breaks already-shared
  `?topics=` links.** The old slug is dropped on read, so the link degrades to
  an unfiltered list rather than an empty one — but it no longer filters.
- **Accessors are frozen at first render.** See the note under
  `useArticleFilters`; they are read once into a ref.
- **`slugifyTopic` keeps Latin and Cyrillic only.** A tag in any other script
  slugs to `""` and is dropped from the topic list entirely.
- **`getDate` must be an ISO (`YYYY-MM-DD`-prefixed) string.** A `Date` object or a
  non-ISO format yields a garbage year, because the year is sliced off the
  string rather than parsed.
- **`isFiltered` ignores sort.** Changing sort alone leaves it `false`. Use
  `canReset` for a Reset button that should also undo a sort change.
- **No pagination.** `signature` exists so you can reset your own.

## Development

```bash
npm test -w article-filters      # vitest — 31 over the pure layer, 2 over the bar's slot
npm run build -w article-filters # tsc, emits dist/
```

`src/article-filters.test.ts` covers `filters.ts`; `src/ArticleFilterBar.test.tsx`
renders the bar with `renderToStaticMarkup` to pin the `children` slot. The hook
has no test coverage. Every example in the API reference above is taken
from a passing assertion in that file.

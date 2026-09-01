# @prismetic/article-filters

Topic / year / sort filtering for CMS article lists across the ITE fleet.

Two layers, used independently:

- **`useArticleFilters`** — all state, derivation and URL sync. No DOM, no
  design. Used by every site including the MUI ones.
- **`ArticleFilterBar`** — the shadcn/Radix control row. Every class is a prop;
  shared defaults ship as plain CSS.

## Install

```
pnpm add @prismetic/article-filters
```

Then import the defaults once, next to the other package styles:

```css
/* globals.css */
@import "@prismetic/form-utils/styles.css";
@import "@prismetic/article-filters/styles.css";
```

There is deliberately **no `@source` directive to add**. The defaults are plain
CSS, so Tailwind never has to scan this package — which matters because
`node_modules/@prismetic/*` is a pnpm symlink locally but a real directory
under Azure's `npm install`, and a `@source` path that resolves in one can
emit nothing in the other.

## Usage

```tsx
const filters = useArticleFilters(articles);

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
```

Reset pagination when the result set changes:

```tsx
const { signature } = filters;
useEffect(() => setVisibleCount(PAGE_SIZE), [signature]);
```

### Field names

Defaults read `id`, `Title`, `PublishedDate` and `Tags[].Name`. Sites that name
things differently pass accessors:

```tsx
useArticleFilters(articles, {
  getTitle: (a) => a.Heading,
  getTags: (a) => a.Categories,
});
```

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
- The year is read off the `YYYY-MM-DD` string, not through `new Date()`, which
  would shift a Jan 1 article into the previous year west of UTC.

## Why the panel is a non-modal Popover

Radix's modal scroll lock pads `<body>` to compensate for a scrollbar it
removes. These sites scroll on `<html>` (their `globals.css` puts `overflow-x`
on `body`), so the scrollbar never goes away and the compensation lands as a
pure width change — shifting the centred container sideways every time a panel
opens. Non-modal avoids the whole class of bug. The MUI bar needs
`disableScrollLock: true` for the same reason.

## Caveat

Renaming a tag in Strapi changes its slug and breaks already-shared
`?topics=` links.

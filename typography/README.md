# @prismetic/typography

> Built for Prismetic's ITE Strapi-backed Next.js sites on shadcn and Tailwind v4,
> where the words a title highlights are marked inside a plain-text CMS field.
> Nothing here is Strapi-specific.

`Title` renders a heading whose tag follows its size, and turns two markers that
editors type in the CMS, `//` and `##`, into accent spans the site styles.

The version is 0.x on purpose: one planned split-title design is not settled yet
and may change the API.

## Install

```bash
npm install @prismetic/typography tailwind-merge
```

shadcn sites already have `tailwind-merge`.

## Requirements

| | |
| --- | --- |
| Peer | `react >=18`: nothing here uses a React 19-only API. `tailwind-merge ^3`: merges `className` with the size class |
| Dependencies | none |
| Next.js | not a peer dep, never imported |
| `"use client"` | **not needed.** `Title` has no hooks or state and renders in server components |
| Side effects | none at import; `"sideEffects": false` |
| Tailwind | v4. Needs the `@source` line and the eight sizes defined by the site, see [Tailwind setup](#tailwind-setup) |
| Tested against | React 19 |

## Quick start

```tsx
import { Title } from "@prismetic/typography";

<Title>{data.Title}</Title>
<Title size="3xl" pageHeader>{data.Heading}</Title>
<Title size="lg" className="text-white" accentClassName="text-white">{data.Title}</Title>
```

`<Title>Discover // TransRussia</Title>` renders:

```html
<h2 data-slot="title" data-size="xl" class="text-size-xl">Discover <span data-slot="title-accent" data-marker="//" style="-webkit-text-fill-color:currentColor">TransRussia</span></h2>
```

A site's own `Title` is usually a default export. The package exports `Title` by
name only, so replacing it is one changed import line:

```diff
- import Title from "@/components/ui/Title";
+ import { Title } from "@prismetic/typography";
```

## Tailwind setup

### 1. Let Tailwind see the class names

Tailwind v4 does not scan `node_modules`. Add one `@source` line to the site's
`globals.css`; the path is relative to that file:

```css
@source "../../node_modules/@prismetic/typography/dist"; /* src/app/globals.css */
@source "../node_modules/@prismetic/typography/dist";    /* app/globals.css */
```

Without it, `text-size-*` classes used only inside the package are never
emitted, and tsc and the build stay green.

### 2. Define the eight sizes

The package ships no CSS and no size values. `@source` only makes Tailwind see
the class names; with no definition nothing is generated. Define all eight
(`xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`) as utilities:

```css
@utility text-size-xl {
  @apply text-4xl lg:text-5xl font-semibold leading-[1.06];
}
```

or as theme tokens:

```css
@theme {
  --text-size-xl: 3rem;
  --text-size-xl--line-height: 1.06;
}
```

## Markers

Editors type markers in the CMS title. They are read only when `children` is a
single string.

| Marker | Highlights |
| --- | --- |
| `// word` or `//word` | the next word. Several per title; each is its own one-word span |
| `##text##` | everything up to the next `##`, as one span |
| `## text` with no closing `##` | everything to the end, as one span |

Not markers, rendered as typed: `word//` (a CMS content fix, not a marker), a
single `#` (`Digest #3`), the `//` in `https://x.com`. Inside a `##` run, only a
standalone `//` or one leading `//` on a word is dropped: `## //a//b` → `a//b`.

| CMS title | Renders as (accent as `[marker:text]`) |
| --- | --- |
| `Discover // TransRussia` | `Discover [//:TransRussia]` |
| `Why Choose // TransRussia // 2027` | `Why Choose [//:TransRussia] [//:2027]` |
| `// Inner   page // header` | `[//:Inner] page [//:header]` |
| `Why Exhibit at // Weldex 2025` | `Why Exhibit at [//:Weldex] 2025` |
| `Meet ## at mitt 2027?` | `Meet [##:at mitt 2027?]` |
| `Plan //your visit ## and more // stuff` | `Plan [//:your] visit [##:and more stuff]` |
| `See https://x.com // here` | `See https://x.com [//:here]` |
| `##Only tail` | `[##:Only tail]` |
| `trailing //` | `trailing` |
| `Have // Questions? //` | `Have [//:Questions?]` |
| `Why Exhibit ## At MITT 2027?` | `Why Exhibit [##:At MITT 2027?]` |
| `Get Connected with  ##Aquaflame 2025##` | `Get Connected with [##:Aquaflame 2025]` |
| `##WorldFood## Moscow 2026` | `[##:WorldFood] Moscow 2026` |
| `A ##b## c ##d e` | `A [##:b] c [##:d e]` |
| `Plan //your visit ## and // more` | `Plan [//:your] visit [##:and more]` |
| `Conference// Programme` | `Conference// Programme` |
| `Digest #3` | `Digest #3` |

JSX with an expression in it passes an array, not a string, so its markers are
not read. `<Title>Discover // {site}</Title>` renders `//` literally; pass one
string instead: ``<Title>{`Discover // ${site}`}</Title>``.

## Styling hooks

| Hook | On | Value |
| --- | --- | --- |
| `data-slot="title"` | heading | always |
| `data-size` | heading | the `size` prop, default `xl` |
| `data-slot="title-accent"` | accent span | always |
| `data-marker` | accent span | `//` or `##` |

### Accent colour

The package sets none. Each site gives its default in `@layer base`:

```css
@layer base {
  [data-slot="title-accent"] { color: var(--color-mainColor3); }
}
```

⚠️ **Keep that rule in a layer.** An unlayered rule beats every layered rule
regardless of specificity, so a bare `[data-slot="title-accent"] { color }`
silently overrides `accentClassName="text-white"`. Put it in `base` or
`components`, not in `utilities` (same specificity as `.text-white`, so source
order decides) and not in a new named layer (a layer first declared after
Tailwind's ends up after `utilities` and wins). A site that defines no rule gets
the heading colour.

### One-off overrides

`accentClassName` goes on every accent span exactly as given, without twMerge.
Use it where one title needs something the site default does not give, such as
a white accent on a dark section:

```tsx
<section className="bg-mainColor1 text-white">
  <Title className="text-white" accentClassName="text-white">{data.Title}</Title>
</section>
```

The accent span carries `style="-webkit-text-fill-color:currentColor"` inline,
so a gradient-text size (`background-clip: text` with a transparent fill) cannot
hide it. Site CSS can override that only with `!important`.

### Layout examples

Mitt's stacked line, the `##` run on its own line below the rest:

```css
@layer components {
  [data-slot="title"] > [data-marker="##"] {
    display: block;
    margin-top: 0.12em;
    translate: 1em 0;
    font-size: 0.92em;
    line-height: 0.8;
  }
}
```

Mitt's hanging accent on 3xl titles, the `//` word on its own line, shifted
right by part of its own width:

```css
@layer components {
  [data-slot="title"][data-size="3xl"] > [data-marker="//"] {
    display: block;
    width: fit-content;
    margin-top: 0.15em;
    translate: 26% 0;
    font-size: 0.96em;
    line-height: 0.7;
  }
}
```

AirventV2's underline bar under the heading, opted into per title with
`<Title className="title-bar">`:

```css
@utility title-bar {
  &::after {
    content: "";
    display: block;
    width: 4rem;
    height: 1px;
    margin-top: 1rem;
    background: var(--color-mainColor2);
  }
}
```

## API reference

### `<Title />`

```tsx
<Title size="xl" pageHeader={false} as={...} className={...} accentClassName={...}>
  {children}
</Title>
```

| prop | type | default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | — | markers are read only in a single string; anything else renders untouched |
| `size` | `TitleSize` | `"xl"` | picks `text-size-<size>` and the default tag |
| `pageHeader` | `boolean` | `false` | renders `h1`; beats `as` |
| `as` | `ElementType` | — | overrides the size's tag |
| `className` | `string` | — | merged after `text-size-<size>` by twMerge |
| `accentClassName` | `string` | — | set as `class` on every accent span as given; no `class` attribute when omitted |

No other HTML attributes (`id`, `aria-*`) are passed through in 0.1.0.

The tag comes from `pageHeader` first, then `as`, then the size:

| `size` | tag |
| --- | --- |
| `4xl`, `3xl`, `2xl`, `xl` | `h2` |
| `lg` | `h3` |
| `md` | `h4` |
| `sm` | `h5` |
| `xs` | `h6` |

`text-size-*` is in twMerge's `font-size` group, so `text-lg` or `text-[20px]` in
`className` replaces it and `text-white` does not.

What renders for edge-case `children`:

| `children` | renders |
| --- | --- |
| `undefined`, `null`, `false`, `""`, `[]` | `null` |
| a blank string | `null` |
| a string whose markers leave nothing: `"//"`, `"##"`, `"####"`, `"## ##"`, `"// ##"` | `null` |
| `0` | a heading containing `0` |
| `[""]` | an empty heading, as the pilot did |

### Type exports

```ts
type TitleSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

interface TitleProps {
  children?: ReactNode;
  pageHeader?: boolean;
  size?: TitleSize;
  className?: string;
  accentClassName?: string;
  as?: ElementType;
}
```

There is no default export.

## Behaviour notes

- Precedence: `pageHeader` beats `as`.
- Any string containing `//` or `##` anywhere is split on whitespace and
  rejoined with single spaces, even when nothing in it is a marker
  (`"Visit\nhttps://x.com"` → `"Visit https://x.com"`). Strings with neither
  render exactly as given.
- `##` pairs left to right; an odd one out runs to the end. `"### title"` →
  `[##:# title]`; `"## a ## b"` → `[##:a] b`.
- A `##` glued to a word still separates it with a space: `"a##b##c"` →
  `a [##:b] c`, `"##Aquaflame 2025##s"` → `[##:Aquaflame 2025] s`.
- A `//` right before a `##` run is dropped: `"// ##x##"` → `[##:x]`.
- `word//` stays literal; that is a CMS content fix, not a marker.
- `className="text-size-sm"` replaces the size class, but `data-size` still
  reports the `size` prop.
- The accent fill is inline; site CSS can override it only with `!important`.
- The package's twMerge knows only `text-size-*`, like the pilot sites' `cn`.
  Custom font-size classes another site registers in its own `cn` do not replace
  `text-size-*` here.
- Text inside markers is rendered as React text: escaped, never HTML.
- Plain words between two accents form one text node, so `renderToString` adds
  no `<!-- -->` separators inside them.

## Development

```bash
npm test -w typography     # vitest — 103 tests, against the pilot Title as an oracle
npm run build -w typography
```

The oracle is the pilot site `Title` copied byte-for-byte into
`src/__fixtures__/`, rendered through the pilot sites' real `cn`. The tests
prove the package renders the same markup for every listed input (all marker
cases, the behaviour notes, plain strings, the null-guard inputs, numbers, an
element, arrays) under each of 22 prop combinations (every size, `pageHeader`,
`as`, `className` merges, `accentClassName`), with no exclusions. They also pin
the 17 requester cases and the 6 inside-`##` cases above, the tags, attributes
and class merge, the null guard, one text node between accents, no React key
warnings, every `"text-size-<size>"` as a full literal in the source and no
`"use client"`.

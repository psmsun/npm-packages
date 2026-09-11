# @prismetic/text-utils

> Built for Prismetic's ITE Strapi-backed Next.js sites, where most copy lives in
> plain-text CMS fields rather than rich text. Nothing here is Strapi-specific.

Lets content editors put links inside plain-text CMS fields by writing
`[label](url)`, without giving them a rich-text editor.

## Install

```bash
npm install @prismetic/text-utils
```

## Requirements

| | |
| --- | --- |
| Peer | `react >=18` — accurate as declared; nothing here uses a React 19-only API |
| Dependencies | none |
| Next.js | not a peer dep, never imported — the component resolves no URLs itself |
| `"use client"` | **not needed.** `MarkdownLinks` is not a hook and renders in server components |
| Tested against | React 19 / Next 16 |

`parseMarkdownLinks` has no React import at all and runs anywhere.

## Quick start

```tsx
import { MarkdownLinks } from "@prismetic/text-utils";
import NavigationLink from "@/components/NavigationLink";

<MarkdownLinks text={data.Content} link={NavigationLink} />;
```

### Real-world usage

Handling it once in a shared text component means every plain-text field on the
site accepts links with no change at the call sites:

```tsx
const Text = ({ as: Component = "p", children, linkify = true, ...props }) => (
  <Component {...props}>
    {linkify && typeof children === "string" ? (
      <MarkdownLinks text={children} link={NavigationLink} />
    ) : (
      children
    )}
  </Component>
);
```

⚠️ **Set `linkify={false}` wherever the text sits inside a link.** Card
excerpts and button labels are often wrapped in one big `<a>`; a link inside a
link is invalid HTML, and the browser repairs it by tearing the outer anchor
apart — the card stops being clickable and React logs a hydration mismatch.

## API reference

### `<MarkdownLinks />`

```tsx
<MarkdownLinks text={...} link={...} className={...} />
```

| prop | type | default | |
| --- | --- | --- | --- |
| `text` | `unknown` | — | the raw CMS string; anything that is not a string renders nothing |
| `link` | `LinkComponent` | `"a"` | renders each link — pass the site's own link component |
| `className` | `string` | `"underline"` | applied to every link, not to the text runs |

Return values are deliberately minimal:

| `text` | renders |
| --- | --- |
| not a string, or `""` | `null` |
| a string with no links | the bare string, **no wrapper element** |
| a string with links | a fragment of text runs and `link` elements |

That middle row matters: a field that never contains a link produces exactly the
DOM it did before this component was introduced.

**It is not a hook.** It renders inside server components and is safe to call
inside a `.map()` — neither of which a `useMarkdownLinks` hook would allow.

**It does no URL handling.** Every href goes straight to `link`, so whatever
that component already knows about bare domains, external targets, `rel` and
prefetching applies here too, in one place. The only href it inspects at all is
an unsafe scheme, which `parseMarkdownLinks` keeps as literal text.

`link` is called as `<Link href={href} className={className}>{label}</Link>`, so
any component accepting those three props works — including a bare tag name
string like `"a"` or `"button"`.

### `parseMarkdownLinks(text)`

```ts
parseMarkdownLinks(text: unknown): MarkdownToken[]
```

The pure tokeniser behind the component. No React, no DOM.

| param | type | |
| --- | --- | --- |
| `text` | `unknown` | deliberately `unknown`, so a CMS field of any type can be passed straight in |

Returns an array of tokens in source order. Returns `[]` for anything that is
not a non-empty string.

```ts
parseMarkdownLinks("See [the programme](/programme) today");
// [
//   { type: "text", value: "See " },
//   { type: "link", label: "the programme", href: "/programme", offset: 4 },
//   { type: "text", value: " today" },
// ]

parseMarkdownLinks("Just plain copy");
// [{ type: "text", value: "Just plain copy" }]

parseMarkdownLinks("[a](/a) middle [b](/b)");
// [
//   { type: "link", label: "a", href: "/a", offset: 0 },
//   { type: "text", value: " middle " },
//   { type: "link", label: "b", href: "/b", offset: 15 },
// ]

parseMarkdownLinks("");        // []
parseMarkdownLinks(null);      // []
parseMarkdownLinks(undefined); // []
parseMarkdownLinks(42);        // []
parseMarkdownLinks({});        // []
```

Newlines are preserved inside text tokens, so a `whitespace-pre-line` parent
still breaks lines exactly as it did before:

```ts
parseMarkdownLinks("line one\nline [two](/2)\nline three")[0];
// { type: "text", value: "line one\nline " }
```

Malformed markdown is left as literal text rather than half-parsed:

```ts
parseMarkdownLinks("[no closing paren](/a"); // [{ type: "text", value: "[no closing paren](/a" }]
parseMarkdownLinks("[empty]()");             // [{ type: "text", value: "[empty]()" }]
parseMarkdownLinks("(/a)[reversed]");        // [{ type: "text", value: "(/a)[reversed]" }]
parseMarkdownLinks("costs (approx) [see](/x)");
// [{ type: "text", value: "costs (approx) " },
//  { type: "link", label: "see", href: "/x", offset: 15 }]
```

Every href is passed through untouched — `/programme`, `programme`,
`itegroup.com`, `https://itegroup.com`, `mailto:a@b.com`, `tel:+441234`,
`#speakers`, `/brochure.pdf` and even `/https://itegroup.com` all arrive at your
`link` component exactly as the editor typed them.

The module-level regex has its `lastIndex` reset on entry, so repeated calls
with the same input return identical results.

### Type exports

```ts
interface TextToken {
  type: "text";
  value: string;
}

interface LinkToken {
  type: "link";
  label: string;
  href: string;
  offset: number;   // index of the match in the source string
}

type MarkdownToken = TextToken | LinkToken;
```

`offset` exists so a renderer has a stable React key that survives re-tokenising;
`MarkdownLinks` uses it for exactly that.

Also exported: `LinkComponent` (any `ElementType`, or a component taking
`{ href, className?, children }`) and `MarkdownLinksProps`.

## Security

Unsafe schemes never become a live href. `javascript:`, `vbscript:` and `data:`
links are emitted as literal `[label](url)` text, so they render visibly instead
of silently becoming clickable.

Whitespace and control characters are stripped before the scheme is tested,
because a browser ignores them inside a scheme but a naive regex does not — all
of these are caught:

```
javascript:alert(1        JavaScript:alert(1       data:text/html;base64,…
vbscript:msgbox           java<TAB>script:alert(1  java<NEWLINE>script:alert(1
 javascript:alert(1
```

A safe link in the same string still renders:

```ts
parseMarkdownLinks("[bad](javascript:x) and [good](/g)").filter((t) => t.type === "link");
// [{ type: "link", label: "good", href: "/g", offset: 24 }]
```

Note the scheme check is the **only** thing inspected. Everything else is your
`link` component's responsibility.

## What editors can write

| Written in the CMS | Result |
| --- | --- |
| `[Register now](/registration)` | link |
| `[ITE Group](itegroup.com)` | link — the link component adds the scheme |
| `[Email us](mailto:a@b.com)` | link |
| `[Brochure](/brochure.pdf)` | link |
| `**bold**`, `# heading`, `- list` | literal text — links only |
| `https://example.com` | literal text — bare URLs are not auto-linked |

## Limits

These are deliberate; the constraint is what keeps the feature safe to hand to
content editors.

- **Links only.** Rich-text fields already exist for anything more.
- **A `)` inside a URL truncates it.** `[wiki](https://x.org/A_(b))` yields the
  href `https://x.org/A_(b`. Percent-encode it as `%29`.
- **An empty label or href does not parse.** Both `[](url)` and `[label]()`
  require at least one character, so they stay literal text.
- **No escape syntax.** A literal `[label](url)` cannot be written.
- **No nesting.** A label cannot contain `]`, so `[a [b] c](/x)` matches nothing at
  all and renders as literal text.
- **Unsafe schemes render as text.** See Security above.
- **Newlines survive**, so a `whitespace-pre-line` parent breaks lines exactly
  as it did before.

## Development

```bash
npm test -w text-utils     # vitest — 13 tests, all against parseMarkdownLinks
npm run build -w text-utils
```

`MarkdownLinks` itself has no test coverage; the tokeniser it delegates to is
covered exhaustively, including every unsafe-scheme variant.

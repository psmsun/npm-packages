# @prismetic/text-utils

Lets content editors put links inside plain-text CMS fields by writing
`[label](url)`, without giving them a rich-text editor.

```bash
npm install @prismetic/text-utils
```

React is the only peer dependency. There is no `next` dependency: the component
never resolves a URL, it hands every href to a link component you pass in.

## `<MarkdownLinks>`

```tsx
import { MarkdownLinks } from "@prismetic/text-utils";
import NavigationLink from "@/components/NavigationLink";

<MarkdownLinks text={data.Content} link={NavigationLink} />;
```

| Prop | Default | |
| --- | --- | --- |
| `text` | — | the raw CMS string; anything that is not a string renders nothing |
| `link` | `"a"` | renders each link — pass the site's own link component |
| `className` | `"underline"` | applied to every link |

**It is not a hook.** It renders inside server components and is safe to call
inside a `.map()` — neither of which a `useMarkdownLinks` hook would allow.

**It does no URL handling.** Every href goes straight to `link`, so whatever
that component already knows about bare domains, external targets, `rel` and
prefetching applies here too, in one place.

**Text with no links renders as the bare string**, so a field that never
contains a link produces exactly the DOM it did before.

### Wiring it into a shared text component

Handling it once means every plain-text field on the site accepts links with no
change at the call sites:

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

## `parseMarkdownLinks(text)`

The pure tokeniser behind the component. No React, no DOM.

```ts
parseMarkdownLinks("See [the programme](/programme) today");
// [
//   { type: "text", value: "See " },
//   { type: "link", label: "the programme", href: "/programme", offset: 4 },
//   { type: "text", value: " today" },
// ]
```

## What editors can write

| Written in the CMS | Result |
| --- | --- |
| `[Register now](/registration)` | link |
| `[ITE Group](itegroup.com)` | link — the link component adds the scheme |
| `[Email us](mailto:a@b.com)` | link |
| `[Brochure](/brochure.pdf)` | link |
| `**bold**`, `# heading`, `- list` | literal text — links only |
| `https://example.com` | literal text — bare URLs are not auto-linked |

## Deliberate limits

- **Links only.** Rich-text fields already exist for anything more.
- **A `)` inside a URL truncates it.** `[wiki](https://x.org/A_(b))` yields the
  href `https://x.org/A_(b`. Percent-encode it as `%29`.
- **No escape syntax.** A literal `[label](url)` cannot be written.
- **Unsafe schemes render as text.** `javascript:`, `vbscript:` and `data:`
  hrefs are emitted as literal `[label](url)` rather than becoming a live href,
  including when padded with whitespace or control characters.
- **Newlines survive**, so a `whitespace-pre-line` parent breaks lines exactly
  as it did before.

## Development

```bash
npm test -w text-utils     # vitest
npm run build -w text-utils
```

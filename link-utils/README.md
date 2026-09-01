# @prismetic/link-utils

CMS href normalisation for Next.js sites. Extracted verbatim from the
`NavigationLink` component every ITE site carried its own copy of, so the
resolution is unchanged.

```bash
npm install @prismetic/link-utils
```

No dependencies and no `next` peer — it returns props, it does not render.

## `resolveHref(href?, target?)`

Turns a raw Strapi value into the props a link element needs.

```ts
import { resolveHref } from "@prismetic/link-utils";

resolveHref("mosbuild.com");
// { href: "https://mosbuild.com", target: "_blank", rel: "noopener noreferrer" }

resolveHref("/programme");
// { href: "/programme", target: "_self" }

resolveHref("/brochure.pdf");
// { href: "/brochure.pdf", target: "_self", prefetch: false }
```

What it handles:

| Input | Output href | Why |
| --- | --- | --- |
| `mosbuild.com` | `https://mosbuild.com` | a bare hostname would otherwise resolve as `/mosbuild.com` |
| `/https://itegroup.com` | `https://itegroup.com` | a common CMS typo |
| `programme` | `/programme` | schemeless relative paths get a leading slash |
| `/sectors//food` | `/sectors/food` | accidental double slashes |
| `""`, `"   "`, `undefined` | `/` | an empty CMS field must not produce a broken link |
| `brochure.pdf` | `/brochure.pdf` + `prefetch: false` | `next/link` prefetches an RSC payload a static export has no route for, 404ing on every page view |

`target` is `_blank` (with `rel="noopener noreferrer"`) for `http(s)://` and
protocol-relative URLs, `_self` for everything else including `#anchor`,
`mailto:` and `tel:`. An explicit `target` argument always wins.

**It does not append a trailing slash**, matching the behaviour every site
shipped before this package existed — even though those sites build with
`trailingSlash: true`. Changing that affects every internal link on a site and
belongs in its own change.

## Usage in a Next.js component

```tsx
import Link from "next/link";
import { resolveHref } from "@prismetic/link-utils";

const NavigationLink = ({ children, href, target, className, ...props }) => {
  const { href: resolved, ...linkProps } = resolveHref(href, target);

  return (
    <Link href={resolved} className={className} {...linkProps} {...props}>
      {children}
    </Link>
  );
};
```

## Also exported

- `withScheme(url)` — prefixes `https://` when the value is a bare domain.
- `isBareDomain(url)` — the test behind it; `brochure.pdf` is not a domain.
- `withTrailingSlash(url)` — appends a slash to an internal route, preserving
  query strings and hashes and leaving external URLs and static files alone.
  Used for CMS redirect destinations, not by `resolveHref`.

## Development

```bash
npm test -w link-utils     # vitest
npm run build -w link-utils
```

The `resolveHref` tests are a behavioural lock: a failure means the packaged
version has diverged from what the sites render today.

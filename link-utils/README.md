# @prismetic/link-utils

> Built for Prismetic's ITE Strapi-backed Next.js sites. Extracted verbatim from
> the `NavigationLink` component every ITE site carried its own copy of, so the
> resolution is unchanged.

CMS href normalisation: bare domains gain a scheme, external links open in a new
tab with `rel`, and links to static files opt out of `next/link` prefetching.

## Install

```bash
npm install @prismetic/link-utils
```

## Requirements

| | |
| --- | --- |
| Dependencies | none |
| Peer dependencies | **none at all** — not even React |
| Next.js | not a peer dep, never imported — this returns props, it does not render |
| Module format | ESM |

Because it only computes props, it runs anywhere: a server component, a client
component, a redirect config, or a Node script.

## Quick start

```ts
import { resolveHref } from "@prismetic/link-utils";

resolveHref("mosbuild.com");
// { href: "https://mosbuild.com", target: "_blank", rel: "noopener noreferrer" }

resolveHref("/programme");
// { href: "/programme", target: "_self" }

resolveHref("/brochure.pdf");
// { href: "/brochure.pdf", target: "_self", prefetch: false }
```

### Real-world usage

The whole point is one `NavigationLink` per site, spreading the result:

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

`rel` and `prefetch` are omitted from the result when they don't apply, so
spreading never sets `rel={undefined}` or overrides `next/link`'s default
prefetch on a real route.

## API reference

### `resolveHref(href?, target?)`

```ts
resolveHref(href?: string, target?: string): ResolvedHref
```

| param | type | |
| --- | --- | --- |
| `href` | `string \| undefined` | the raw value, typically straight from Strapi |
| `target` | `string \| undefined` | an explicit target that overrides the computed one |

Returns `ResolvedHref`:

```ts
interface ResolvedHref {
  href: string;
  target: string;
  rel?: string;        // "noopener noreferrer", only when target is _blank
  prefetch?: false;    // only for static files; undefined keeps next/link's default
}
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

**Target.** `_blank` (with `rel="noopener noreferrer"`) for `http(s)://` and
protocol-relative `//` URLs; `_self` for everything else. An explicit `target`
argument always wins — and still gets `rel` if it is `_blank`:

```ts
resolveHref("https://itegroup.com", "_self");
// { href: "https://itegroup.com", target: "_self" }        ← no rel

resolveHref("/programme", "_blank");
// { href: "/programme", target: "_blank", rel: "noopener noreferrer" }
```

**Treated as external — left untouched, but same-tab:**

```ts
resolveHref("#speakers");      // { href: "#speakers",      target: "_self" }
resolveHref("mailto:a@b.com"); // { href: "mailto:a@b.com", target: "_self" }
resolveHref("tel:+441234");    // { href: "tel:+441234",    target: "_self" }
```

The full set left untouched is any value starting `#`, containing `://`, or
beginning with one of:

`http://` `https://` `//` `mailto:` `tel:` `sms:` `ftp:` `sftp:` `file:`
`skype:` `whatsapp:` `slack:` `zoommtg:` `spotify:` `steam:` `data:` `blob:`
`ws:` `wss:`

**Prefetch.** `prefetch: false` is set when the path — taken before any `?` or
`#` — ends in one of:

`.xml` `.pdf` `.txt` `.json` `.csv` `.zip` `.rss` `.doc(x)` `.xls(x)` `.ppt(x)`
`.ics` `.jpg`/`.jpeg` `.png` `.gif` `.svg` `.webp` `.avif` `.mp4` `.webm` `.mp3`

```ts
resolveHref("/brochure.pdf").prefetch;    // false
resolveHref("/sitemap.xml").prefetch;     // false
resolveHref("/brochure.pdf?v=2").prefetch;// false
resolveHref("/programme").prefetch;       // undefined
```

**It does not append a trailing slash**, matching the behaviour every site
shipped before this package existed — even though those sites build with
`trailingSlash: true`. Changing that affects every internal link on a site and
belongs in its own change. Use `withTrailingSlash` explicitly where you need it.

---

### `isBareDomain(url)`

```ts
isBareDomain(url: string): boolean
```

Whether a value is a hostname written without a scheme. The test behind
`withScheme`, exported because redirect tooling needs the same question answered.

A value qualifies when it has no leading `/` or `#`, contains no `://`, and its
first segment (up to the first `/`, `?` or `#`) contains a dot, does not end in a
known file extension, and matches `^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$`.

```ts
isBareDomain("mosbuild.com");          // true
isBareDomain("summit.rosupack.com");   // true
isBareDomain("mosbuild.com/programme");// true — the path is ignored

isBareDomain("/programme");            // false
isBareDomain("#speakers");             // false
isBareDomain("https://mosbuild.com");  // false
isBareDomain("");                      // false
isBareDomain("brochure.pdf");          // false — filenames that look like hostnames
isBareDomain("sitemap.xml");           // false
```

### `withScheme(url)`

```ts
withScheme(url: string): string
```

Prefixes `https://` when `isBareDomain(url)`, otherwise returns the input
unchanged. Called by `resolveHref` before its external and new-tab checks, so
those see the real URL.

```ts
withScheme("mosbuild.com");         // "https://mosbuild.com"
withScheme("/programme");           // "/programme"
withScheme("https://itegroup.com"); // "https://itegroup.com"
withScheme("brochure.pdf");         // "brochure.pdf"
```

### `withTrailingSlash(url)`

```ts
withTrailingSlash(url: string): string
```

Appends a slash to an internal route. Used for **CMS redirect destinations**,
and deliberately **not** by `resolveHref`.

The consuming sites build with `trailingSlash: true`, so every internal page URL
ends in a slash. A redirect destination stored without one lands on a URL the
host then 302s to the canonical form — an extra hop on every redirect. Stray
whitespace is trimmed too: a destination saved as `"/sectors "` is a 404, not a
redirect.

Query strings and hashes are preserved, and external URLs and static files are
left alone:

```ts
withTrailingSlash("/sectors");            // "/sectors/"
withTrailingSlash("/sectors ");           // "/sectors/"
withTrailingSlash("/sectors/");           // "/sectors/"
withTrailingSlash("/sectors?a=1");        // "/sectors/?a=1"
withTrailingSlash("/sectors#top");        // "/sectors/#top"
withTrailingSlash("https://itegroup.com");// "https://itegroup.com"
withTrailingSlash("/brochure.pdf");       // "/brochure.pdf"
```

Anything not starting with `/` after trimming is returned as-is.

### Type exports

`ResolvedHref` — expanded under `resolveHref` above.

## Limits

- **Two different file-extension lists.** `resolveHref`'s prefetch test and
  `isBareDomain`/`withTrailingSlash`'s "is this a filename" test use separate
  regexes that have drifted apart. `.rss` and `.ics` are in the first only;
  `.rar` and `.ico` are in the second only. Two consequences:

  ```ts
  resolveHref("feed.rss");
  // { href: "https://feed.rss", target: "_blank", ... }
  //   ^ read as a bare domain, because .rss is absent from the filename list

  resolveHref("/archive.rar").prefetch;  // undefined
  resolveHref("/icon.ico").prefetch;     // undefined
  //   ^ prefetched by next/link, the 404 this package exists to prevent
  ```

  Neither shape occurs in the fleet's CMS data today.

- **A bare hostname wins over a relative path.** A CMS value of `sectors.food`
  becomes `https://sectors.food`, not `/sectors.food`. The hostname pattern
  cannot tell the two apart.
- **No IDN or punycode handling.** A non-ASCII hostname fails the pattern and is
  treated as a relative path.
- **`resolveHref` never validates that an internal route exists.** It normalises
  shape only.

## Development

```bash
npm test -w link-utils     # vitest — 17 tests
npm run build -w link-utils
```

The `resolveHref` tests are a behavioural lock: a failure means the packaged
version has diverged from what the sites render today.

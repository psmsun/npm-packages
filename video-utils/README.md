# @prismetic/video-utils

> Built for Prismetic's ITE Strapi-backed sites, where editors paste whatever
> YouTube or VK gives them into a plain text field. The functions themselves are
> generic and have no CMS dependency.

Zero-dependency extraction of YouTube and VK video IDs from any URL format, a
bare ID, or a bare ID with share params still attached.

## Install

```bash
npm install @prismetic/video-utils
```

## Requirements

| | |
| --- | --- |
| Module format | ESM only — `import`, no `require` |
| Dependencies | none, and no peer dependencies |
| Environment | Node or browser; uses `URL` and `URLSearchParams`, both standard |
| React | not used — safe in a server component, a build script or a plain `.mjs` |

## Quick start

```js
import { extractVKIDs, extractYoutubeID } from "@prismetic/video-utils";

extractYoutubeID("https://youtu.be/dQw4w9WgXcQ");  // "dQw4w9WgXcQ"
extractVKIDs("-178652725_456239064");              // { oid: "-178652725", id: "456239064" }
```

Both return `null` when nothing can be extracted, so a card can decide whether
to render a player at all:

```jsx
const id = extractYoutubeID(testimonial.VideoUrl);

return id ? <YouTubeEmbed id={id} /> : <QuoteCard {...testimonial} />;
```

> Falling back like this matters: before 1.0.3 a value with pasted share params
> returned `null`, and the card rendered neither its video nor its text.

## API reference

### `extractYoutubeID(input)`

```ts
extractYoutubeID(input: string | null | undefined): string | null
```

| param | type | |
| --- | --- | --- |
| `input` | `string \| null \| undefined` | a URL, a bare ID, or a bare ID with share params |

Returns the video ID, or `null`. The input is trimmed first; any falsy input
short-circuits to `null`.

```js
extractYoutubeID("dQw4w9WgXcQ");                              // "dQw4w9WgXcQ"
extractYoutubeID("https://www.youtube.com/watch?v=dQw4w9WgXcQ"); // "dQw4w9WgXcQ"
extractYoutubeID("https://youtu.be/dQw4w9WgXcQ");             // "dQw4w9WgXcQ"
extractYoutubeID("https://www.youtube.com/embed/dQw4w9WgXcQ"); // "dQw4w9WgXcQ"
extractYoutubeID("https://youtube.com/shorts/dQw4w9WgXcQ");    // "dQw4w9WgXcQ"
extractYoutubeID("https://www.youtube.com/live/dQw4w9WgXcQ");  // "dQw4w9WgXcQ"
extractYoutubeID("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4s"); // "dQw4w9WgXcQ"

extractYoutubeID("VN_F1FAKdMg&t=4s");   // "VN_F1FAKdMg"
extractYoutubeID("VN_F1FAKdMg?t=4s");   // "VN_F1FAKdMg"
extractYoutubeID("VN_F1FAKdMg#t=4s");   // "VN_F1FAKdMg"

extractYoutubeID(null);                        // null
extractYoutubeID("");                          // null
extractYoutubeID("not an id");                 // null
extractYoutubeID("https://example.com/watch"); // null
extractYoutubeID("https://vk.com/foo");        // null
```

**Resolution order** — the first rule that matches wins:

| # | Rule | |
| --- | --- | --- |
| 1 | `^([A-Za-z0-9_-]{11})([?&#].*)?$` | bare ID, optionally trailed by pasted share params. **Anchored**, so it can never match part-way into a URL |
| 2 | `youtu.be/<seg>` | first path segment |
| 3 | `?v=<value>` | the `v` query param, from any host |
| 4 | `/embed/`, `/shorts/`, `/live/`, `/v/` + 11 chars | path forms |
| 5 | not a parseable URL → `[?&]v=<11 chars>` | regex fallback for a fragment like `foo?v=dQw4w9WgXcQ` |

### `extractVKIDs(input)`

```ts
extractVKIDs(input: string | null | undefined): { oid: string; id: string } | null
```

| param | type | |
| --- | --- | --- |
| `input` | `string \| null \| undefined` | a VK video URL, a raw `oid_id`, or a query fragment |

Returns `{ oid, id }` as **strings**, or `null`. VK's embed URL needs both
halves, which is why this returns a pair rather than one id.

```js
extractVKIDs("-178652725_456239064");
// { oid: "-178652725", id: "456239064" }

extractVKIDs("227470780_456240128");
// { oid: "-227470780", id: "456240128" }   ← note the sign, see below

extractVKIDs("227470780_456240128&t=4s");
// { oid: "-227470780", id: "456240128" }

extractVKIDs("https://vk.com/video_ext.php?oid=-227470780&id=456240128&hash=d79895b5c0835fc7");
// { oid: "-227470780", id: "456240128" }

extractVKIDs("https://vk.com/video-144893972_456246327");
// { oid: "-144893972", id: "456246327" }

extractVKIDs("https://vk.com/clip-12345678_456239123");
// { oid: "-12345678", id: "456239123" }

extractVKIDs(null);        // null
extractVKIDs("");          // null
extractVKIDs("nonsense");  // null
```

**Resolution order:**

| # | Rule | |
| --- | --- | --- |
| 1 | starts with `http` → `video_ext.php?oid=&id=` | reads both query params |
| 2 | starts with `http` → `/video<oid>_<id>` or `/clip<oid>_<id>` | path form |
| 3 | contains `oid=` and `id=` | parsed as a bare query fragment, no host needed |
| 4 | `^(-?\d+)_(\d+)([?&#].*)?$` | raw pair, with pasted share params tolerated |

**`oid` is always returned negative.** A positive `oid` is negated before it is
returned, on every path. See Limits.

## Limits

- **`oid` is forced negative, including for user-owned videos.** VK uses a
  negative `oid` for a community and a positive one for a user. The extractor
  negates unconditionally, so `https://vk.com/video215336036_165406371` — a user
  video — returns `{ oid: "-215336036" }`, which addresses a community that is
  not the owner. Every value in the fleet is a community video, so this has never
  surfaced in production. The comment at `src/videoIdUtils.js:53` describes the
  intended behaviour rather than the implemented one.
- **The `?v=` parameter is not length-validated.**
  `extractYoutubeID("https://www.youtube.com/watch?v=abc")` returns `"abc"`. Only
  the bare-ID and path forms enforce 11 characters.
- **`youtu.be/<anything>` returns that segment verbatim.**
  `extractYoutubeID("https://youtu.be/not-an-id-at-all")` returns
  `"not-an-id-at-all"`. The host is trusted; the segment is not checked.
- **No network access and no existence check.** A well-formed ID for a deleted or
  private video extracts exactly like a live one.
- **YouTube playlist, channel and user URLs are not handled.** A `/playlist?list=…`
  URL yields `null` unless it also carries `?v=`.

## Development

```bash
npm test -w video-utils
```

Runs `node --test` against `test/videoIdUtils.test.mjs` — 8 tests, built from
every YouTube and VK value stored in the ITE Strapi testimonial collections.
There is no vitest here and no build step: `src/` is published as-is, and
`src/index.d.ts` is **hand-written**, so a change to a function signature has to
be mirrored there by hand or consumers get types that no longer match.

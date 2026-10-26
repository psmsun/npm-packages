# @prismetic/social-embed-utils

> Built for Prismetic's ITE Strapi-backed sites. Extracted from pharmtech's
> `SocialMediaPosts` pilot. The parsing and the Instagram crop live here because
> they break when LinkedIn or Instagram change their embeds, and one patch
> release should fix every site.

Turns whatever an editor pastes into a CMS field (a LinkedIn "Embed this post"
snippet, a post URL, a urn, an Instagram post or reel URL, Instagram's embed
code, a YouTube video or short URL, YouTube's embed code) into an iframe `src`
on the network's own host. Also carries Instagram's
crop constants and a reader for the height messages its frame posts.

The one piece of shared UI is [`<youtube-cover>`](#youtube-cover), a YouTube
thumbnail (or a CMS cover image) with a play button that loads the real player
only on click.
Everything else is still strings and numbers.

## Install

```bash
npm install @prismetic/social-embed-utils
```

## Requirements

| | |
| --- | --- |
| Dependencies | none |
| Peer dependencies | **none at all**, not even React. `/jsx` needs `@types/react` >= 19 in the site, for types only |
| Module format | ESM |
| Side effects | none at import; `package.json` declares `"sideEffects": false`. `defineYoutubeCover` registers the element only when called |
| Environment | the main entry uses no DOM APIs and runs in Node or a browser. `/youtube-cover` needs a browser; `defineYoutubeCover` is a no-op where `customElements` doesn't exist |
| Entry points | `@prismetic/social-embed-utils` (URL helpers, Instagram crop), `@prismetic/social-embed-utils/youtube-cover` (`defineYoutubeCover`), `@prismetic/social-embed-utils/jsx` (types only: `<youtube-cover>` in React's `JSX.IntrinsicElements`) |

Apart from `<youtube-cover>`, the UI, styling and CMS mapping stay in the site,
and the package only computes strings and numbers.

## Quick start

```ts
import { socialEmbedSrc } from "@prismetic/social-embed-utils";

socialEmbedSrc(
  "linkedin",
  `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:7501237627262795776?collapsed=1" height="670" width="504" frameborder="0" allowfullscreen="" title="Embedded post"></iframe>`,
);
// "https://www.linkedin.com/embed/feed/update/urn:li:share:7501237627262795776?compact=1"

socialEmbedSrc("instagram", "https://www.instagram.com/reels/DblEnWKqOPa/");
// "https://www.instagram.com/reel/DblEnWKqOPa/embed/"

socialEmbedSrc("youtube", "https://www.youtube.com/shorts/I3ye9D7gSRo");
// "https://www.youtube.com/embed/I3ye9D7gSRo"

socialEmbedSrc("linkedin", "see our LinkedIn page"); // null, so skip the post
```

### Sizing an Instagram frame

Instagram's chrome sits inside a cross-origin frame, so the card crops it off:
the frame is shifted up by `INSTAGRAM_CROP.header` and the card is
`instagramCardHeight(frame)` tall. The frame's real height depends on its width,
and Instagram posts it to the parent window as a message:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  INSTAGRAM_CROP,
  INSTAGRAM_PLACEHOLDER_HEIGHT,
  instagramCardHeight,
  instagramEmbedSrc,
  readInstagramMeasure,
} from "@prismetic/social-embed-utils";

const InstagramPost = ({ url }: { url: string }) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [frame, setFrame] = useState(INSTAGRAM_PLACEHOLDER_HEIGHT);
  const src = instagramEmbedSrc(url);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Every Instagram frame on the page posts to the same window.
      if (event.source !== ref.current?.contentWindow) return;

      const height = readInstagramMeasure(event);
      if (height !== null) setFrame(height);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!src) return null;

  return (
    <div style={{ height: instagramCardHeight(frame), overflow: "hidden" }}>
      <iframe
        ref={ref}
        src={src}
        height={frame}
        scrolling="no"
        title="Instagram post"
        style={{ width: "100%", border: 0, marginTop: -INSTAGRAM_CROP.header }}
      />
    </div>
  );
};
```

## API reference

### `socialEmbedSrc(network, pasted)`

```ts
socialEmbedSrc(
  network: "linkedin" | "instagram" | "youtube",
  pasted: string | null | undefined,
): string | null
```

| param | type | |
| --- | --- | --- |
| `network` | `"linkedin" \| "instagram" \| "youtube"` | which parser to run |
| `pasted` | `string \| null \| undefined` | the raw CMS value |

Calls `linkedInEmbedSrc`, `instagramEmbedSrc` or `youtubeEmbedSrc`. Any other
`network` returns `null`. It never falls back to LinkedIn.

### `linkedInEmbedSrc(pasted)`

```ts
linkedInEmbedSrc(pasted: string | null | undefined): string | null
```

Returns `https://www.linkedin.com/embed/feed/update/urn:li:<type>:<id>?compact=1`,
or `null` when no post id is found. Non-string input returns `null`. Nothing throws.

When the text has a `src="…"` attribute, the id is read from that attribute
only. Otherwise it is read from the whole trimmed text. When that attribute or
text is an `http:` or `https:` URL, only its path is read, so a query such as
`?utm_campaign=share-12345` can't beat the real id. A `src` with no id
returns `null`. The URL is always rebuilt on `www.linkedin.com`; the pasted URL
is never passed through.

| Pasted | Output |
| --- | --- |
| "Embed this post" snippet, `src=".../urn:li:share:7501237627262795776?collapsed=1"` | `.../urn:li:share:7501237627262795776?compact=1` |
| `urn:li:share:7498268744561868800` | `.../urn:li:share:7498268744561868800?compact=1` |
| `https://www.linkedin.com/feed/update/urn:li:activity:7503697686274031617/` | `.../urn:li:activity:7503697686274031617?compact=1` |
| `https://www.linkedin.com/feed/update/urn:li:activity:7503697686274031617/?utm_campaign=share-12345` | `.../urn:li:activity:7503697686274031617?compact=1` |
| `https://www.linkedin.com/posts/pharmtech_we-share-25000-samples-activity-7503697686274031617-AbCd` | `.../urn:li:activity:7503697686274031617?compact=1` |
| `<iframe src="https://evil.example/x"></iframe>` | `null` |
| `see our LinkedIn page`, `""`, `null` | `null` |

- **Why `compact=1`.** It is LinkedIn's media-only embed: the post's image fills
  the frame with no header, text or action bar. LinkedIn posts no height
  message, so the site sizes that frame itself.
- **Why the urn type is kept.** A `ugcPost` id addressed as `urn:li:activity:`
  resolves to a different post or to nothing, so `activity`, `ugcPost` and
  `share` are passed through as written.
- **Why the last id wins.** A permalink slug is built from the post's words and
  comes before the real id. In `…we-share-25000-samples-activity-7503…` the
  first match would be `share:25000`.

### `instagramEmbedSrc(pasted)`

```ts
instagramEmbedSrc(pasted: string | null | undefined): string | null
```

Returns `https://www.instagram.com/<kind>/<id>/embed/`, where `kind` is `p`,
`reel` or `tv`, or `null` when no post is found. Non-string input returns `null`.
Nothing throws. The URL is always rebuilt on `www.instagram.com`.

The post URL is taken from, in order: a `data-instgrm-permalink="…"` attribute,
a `src="…"` whose path has `/p/`, `/reel/`, `/reels/` or `/tv/`, then the whole
trimmed text.

| Pasted | Output |
| --- | --- |
| `https://www.instagram.com/p/DdV1vMBOYOy/` | `https://www.instagram.com/p/DdV1vMBOYOy/embed/` |
| `https://www.instagram.com/reels/DblEnWKqOPa/` | `https://www.instagram.com/reel/DblEnWKqOPa/embed/` |
| `https://www.instagram.com/pharmtech_expo/p/DdV1vMBOYOy/` | `https://www.instagram.com/p/DdV1vMBOYOy/embed/` |
| Instagram's embed code (`<blockquote data-instgrm-permalink="…/p/Db-NgmEDrAG/?utm_source=ig_embed…">…<script src="//www.instagram.com/embed.js">`) | `https://www.instagram.com/p/Db-NgmEDrAG/embed/` |
| `//www.instagram.com/p/X/embed/captioned/?cr=1` | `https://www.instagram.com/p/X/embed/` |
| `https://www.youtube.com/embed/dQw4w9WgXcQ` | `null` |

- **Why the permalink comes before `src`.** The permalink names the post the
  embed code was made for. The only `src=` in Instagram's embed code belongs to
  its `embed.js` script, and any other `src=` beside a permalink is a media URL.
- **Why `reels` becomes `reel`.** A share sheet hands out `/reels/` URLs, but
  only `/reel/` is a valid embed path.

### `youtubeEmbedSrc(pasted)`

```ts
youtubeEmbedSrc(pasted: string | null | undefined): string | null
```

Returns `https://www.youtube.com/embed/<id>` with no query parameters, so the
site adds its own. A short gets the same URL as a normal video. Returns `null`
when no video is found, and for non-string input. Nothing throws.

When the text has a `src="…"` attribute, the URL is read from that attribute
only. The URL's host must be `youtube.com`, `www.youtube.com`, `m.youtube.com`,
`youtu.be` or `www.youtube-nocookie.com`. The id must be exactly 11 characters
of `A–Z a–z 0–9 _ -`.

| Pasted | Output |
| --- | --- |
| `https://www.youtube.com/watch?v=mFX_vPKZ7hE&t=42s&list=PLx&si=abc` | `https://www.youtube.com/embed/mFX_vPKZ7hE` |
| `https://m.youtube.com/watch?v=mFX_vPKZ7hE` | `https://www.youtube.com/embed/mFX_vPKZ7hE` |
| `https://youtu.be/mFX_vPKZ7hE?si=abc` | `https://www.youtube.com/embed/mFX_vPKZ7hE` |
| `https://www.youtube.com/shorts/I3ye9D7gSRo` | `https://www.youtube.com/embed/I3ye9D7gSRo` |
| `https://www.youtube.com/live/mFX_vPKZ7hE` | `https://www.youtube.com/embed/mFX_vPKZ7hE` |
| YouTube's embed code (`<iframe … src="https://www.youtube.com/embed/mFX_vPKZ7hE?si=abc" …>`, also with a protocol-relative `src`) | `https://www.youtube.com/embed/mFX_vPKZ7hE` |
| `https://evil.example/watch?v=mFX_vPKZ7hE` | `null` |
| `https://www.youtube.com/watch?v=abc` | `null` |
| `https://www.youtube.com/embed/videoseries?list=PL…` | `null` |

- **Why not `extractYoutubeID` from `@prismetic/video-utils`.** This package
  stays dependency-free. That function also accepts any host, ids of any length
  from `?v=` and `youtu.be`, and `videoseries`, which would each produce a
  broken or foreign embed here.
- **Why `videoseries` is rejected.** It is the 11-character path of a playlist
  embed, not a video id.

### `youtubeThumbnailSrc(pasted, size?)`

```ts
youtubeThumbnailSrc(
  pasted: string | null | undefined,
  size?: "maxresdefault" | "hqdefault", // default "maxresdefault"
): string | null
```

Returns `https://i.ytimg.com/vi/<id>/<size>.jpg`, or `null` wherever
`youtubeEmbedSrc` returns `null`. Any `size` other than `"hqdefault"` at
runtime gives `maxresdefault`, so a bad value can't change the path.

```ts
youtubeThumbnailSrc("https://www.youtube.com/shorts/I3ye9D7gSRo");
// "https://i.ytimg.com/vi/I3ye9D7gSRo/maxresdefault.jpg"

youtubeThumbnailSrc("https://youtu.be/mFX_vPKZ7hE", "hqdefault");
// "https://i.ytimg.com/vi/mFX_vPKZ7hE/hqdefault.jpg"
```

Every video has `hqdefault` (480x360, letterboxed for 16:9). `maxresdefault`
(1280x720) exists only for videos uploaded in HD; see
`isMissingYoutubeThumbnail`.

### `youtubePlayerSrc(pasted)`

```ts
youtubePlayerSrc(pasted: string | null | undefined): string | null
```

Returns `https://www.youtube.com/embed/<id>?autoplay=1&rel=0`, the player to
mount after a click, or `null` wherever `youtubeEmbedSrc` returns `null`.
`rel=0` limits the end screen's suggestions to the same channel.

### `isMissingYoutubeThumbnail(image)`

```ts
isMissingYoutubeThumbnail(image: { naturalWidth: number }): boolean
```

`true` when `image.naturalWidth <= 120`. For a video with no `maxresdefault`,
i.ytimg answers with HTTP 404 and a 120x90 grey placeholder, and an `<img>`'s
`load` event still fires on it. Call it from `onLoad` and switch to
`hqdefault` when it returns `true`; switch at most once.

### `readInstagramMeasure(event)`

```ts
readInstagramMeasure(event: { origin: string; data: unknown }): number | null
```

Reads the frame height from a `message` event posted by an Instagram embed. A
`MessageEvent` fits the parameter as is.

Returns the height only when all of these hold, otherwise `null`:

- `origin` is exactly `https://www.instagram.com` or `https://instagram.com`
- `data` is a JSON string (parsed safely) or an object
- the payload's `type` is `"MEASURE"`
- `details.height` is a positive finite number

It does not check which frame sent the message. Match `event.source` against
your iframe's `contentWindow`, as in the quick start.

```ts
readInstagramMeasure({
  origin: "https://www.instagram.com",
  data: '{"type":"MEASURE","details":{"height":812}}',
}); // 812

readInstagramMeasure({ origin: "https://evil.example", data: "…" }); // null
```

### `INSTAGRAM_CROP`, `INSTAGRAM_PLACEHOLDER_HEIGHT`, `instagramCardHeight(frameHeight)`

```ts
INSTAGRAM_CROP: Readonly<{ header: number; belowMedia: number }>; // { header: 54, belowMedia: 154 }, frozen
INSTAGRAM_PLACEHOLDER_HEIGHT: number;                             // 560
instagramCardHeight(frameHeight: number): number;
```

- `header` is the 54px profile bar above the media.
- `belowMedia` is the 154px under it: "View more on Instagram" 44, actions 41,
  likes 24, comment bar 45.
- `INSTAGRAM_PLACEHOLDER_HEIGHT` is the frame height to use before the first
  `MEASURE` message arrives.
- `instagramCardHeight(frameHeight)` is
  `frameHeight - INSTAGRAM_CROP.header - INSTAGRAM_CROP.belowMedia`, with no
  clamping.

```ts
instagramCardHeight(INSTAGRAM_PLACEHOLDER_HEIGHT); // 352
instagramCardHeight(812);                          // 604
```

## `<youtube-cover>`

A YouTube thumbnail with one shared play button. The real player iframe mounts
only on click, which hides YouTube's pre-play overlay (title, share, watch
later, "Watch on YouTube"); embed parameters can no longer turn that off.

### `defineYoutubeCover(tagName?)`

```ts
import { defineYoutubeCover } from "@prismetic/social-embed-utils/youtube-cover";

defineYoutubeCover(tagName?: string): void // default "youtube-cover"
```

Registers the element. Call it in the browser, before or after the elements
are in the page: elements already in the DOM upgrade when it runs.

- **Idempotent.** A name that is already registered is left alone, whichever
  class holds it, so every component that uses the element can call it.
- **Server-safe.** Importing the entry touches no DOM API, and the call does
  nothing where `customElements` doesn't exist.

### Attributes

| attribute | | default |
| --- | --- | --- |
| `url` | anything `youtubeEmbedSrc` accepts: a watch, short, live or `youtu.be` URL, or YouTube's embed code | none: renders nothing |
| `label` | the play button's `aria-label` and the player's `title` | `"Play video"`, also for an empty label |
| `cover` | an absolute `http:` or `https:` image URL shown instead of the YouTube thumbnail. Anything else (empty, relative, `//…`, `javascript:`, `data:`) is ignored | none: the YouTube thumbnail |

All three are attributes only; the element has no `url`, `label` or `cover`
property. React 19 then sets them as attributes, the same as the
server-rendered HTML.

### Behaviour

- **Cover.** A valid `url` renders a `<button type="button" aria-label="<label>">`
  holding an image (`alt=""`, lazy, async decoding, `object-fit: cover`) and a
  play icon. The image is the `cover` URL when one is set, otherwise the
  `maxresdefault` thumbnail. A missing or invalid `url` renders nothing, even
  with a `cover`.
- **Image fallback, each step once.** A `cover` that errors switches to
  `maxresdefault`; a small cover is kept, because only i.ytimg's missing maxres
  is a placeholder. When `maxresdefault` errors, or loads as the 120px
  placeholder (see `isMissingYoutubeThumbnail`), it switches to `hqdefault`.
  The chain is at most cover → `maxresdefault` → `hqdefault` and never goes
  back, so a deleted video can't loop.
- **Click to play.** The button is replaced by
  `<iframe src="https://www.youtube.com/embed/<id>?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="<label>">`,
  filling the element with no border.
- **Focus.** Focus moves to the player (`preventScroll`), so a keyboard user
  isn't dropped on `<body>`.
- **One player at a time.** Starting a cover sends every other playing cover
  back to its thumbnail, including covers inside other shadow roots, open or
  closed.
- **Event.** Each start dispatches `youtube-cover-play` on the element, with
  `bubbles: true`, `composed: true` and `detail: { id }` (the 11-character
  video id):

  ```ts
  document.addEventListener("youtube-cover-play", (event) => {
    const { id } = (event as CustomEvent<{ id: string }>).detail;
    analytics.track("video_play", { id });
  });
  ```

- **Attribute changes.** A new `url` goes back to the cover for the new video,
  even while playing, and the image chain restarts from `cover` if one is set.
  A new `label` updates the `aria-label`, or the player's `title` in place
  without stopping playback. A new or removed `cover` swaps the image in place
  and restarts the chain from it; while playing, the player keeps going and the
  new image shows when the element returns to its cover. Setting the same
  cover again, or one ignored value for another, changes nothing, so a cover
  that already failed isn't retried.
- **Size.** The element is `display: block`, `width: 100%`, `height: 100%`,
  `position: relative` with `overflow: hidden`, so the site's own box sets the
  aspect ratio. The `hidden` attribute hides it.

### CSS custom properties

Set them on the element or any ancestor; they reach into the shadow root.

| property | default |
| --- | --- |
| `--youtube-cover-button-bg` | `rgba(0, 0, 0, 0.6)` |
| `--youtube-cover-button-radius` | `9999px` |
| `--youtube-cover-button-size` | `56px` |
| `--youtube-cover-button-backdrop` | `none` (a `backdrop-filter` value) |
| `--youtube-cover-icon-color` | `#fff` |
| `--youtube-cover-icon-size` | `20px` |
| `--youtube-cover-focus-color` | `#fff` (the 2px focus ring, inset 4px) |

```css
/* A round, blurred button in the brand colour */
.social-feed youtube-cover {
  --youtube-cover-button-bg: color-mix(in srgb, var(--brand) 50%, transparent);
  --youtube-cover-button-backdrop: blur(4px);
}

/* A square black button */
.video-library youtube-cover {
  --youtube-cover-button-radius: 0;
  --youtube-cover-button-bg: #000;
  --youtube-cover-button-size: 64px;
  --youtube-cover-icon-size: 24px;
}
```

### Next.js

```tsx
"use client";

import type {} from "@prismetic/social-embed-utils/jsx";
import { defineYoutubeCover } from "@prismetic/social-embed-utils/youtube-cover";
import { useEffect } from "react";

export const YoutubeVideo = ({
  url,
  title,
  cover,
}: {
  url: string;
  title: string;
  cover?: string;
}) => {
  useEffect(() => {
    defineYoutubeCover();
  }, []);

  // The site's own 16:9 box; the element fills it.
  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-black">
      <youtube-cover url={url} cover={cover} label={`Play ${title}`} />
    </div>
  );
};
```

The server renders `<youtube-cover url="…" label="…">` as an empty element
inside the box, and it becomes the cover once `defineYoutubeCover` runs. React
leaves out `cover` when it is `undefined`.

`import type {} from "@prismetic/social-embed-utils/jsx"` adds `youtube-cover`
to React's `JSX.IntrinsicElements`, with `url`, `label` and `cover` typed as
optional strings beside the usual HTML props. It emits no code. To declare it once for
the whole site instead, put the same line in a `.d.ts` file that the site's
`tsconfig.json` includes.

## Differences from the pharmtech pilot

- **Own host only.** Output is always rebuilt on `www.linkedin.com` or
  `www.instagram.com`; the pilot passed a pasted `src` or any `/embed/` URL
  through as is.
- **No throwing, no default network.** `null` or `undefined` input returns `null`
  (the pilot threw), and an unknown network returns `null` (the pilot used
  LinkedIn).
- **Strict height.** `readInstagramMeasure` returns only a positive finite
  number (the pilot let strings and negatives through), and reads object `data`
  as well as JSON strings (the pilot ignored objects).
- **Frozen crop.** `INSTAGRAM_CROP` is frozen, and it and
  `INSTAGRAM_PLACEHOLDER_HEIGHT` are typed `number`, not literal `54`/`154`/`560`.
- **Last LinkedIn id wins.** A number in a permalink slug no longer beats the
  real id (the pilot took the first match).

## Limits

- A post with likes hidden drops Instagram's 24px likes row, so the crop eats
  24px of media.
- The crop constants were measured on 2026-10-09 in Chromium on 3 posts at
  280, 360 and 500px frame width. An Instagram layout change means a patch
  release with new numbers.
- LinkedIn urn types recognised: `activity`, `ugcPost` and `share` only. A
  URL-encoded urn (`urn%3Ali%3A…`) is not recognised.
- YouTube needs a full URL with a scheme or a `//` prefix. A bare id
  (`mFX_vPKZ7hE`) or a schemeless `youtube.com/watch?v=…` returns `null`.
  Playlists, channels and old `/v/<id>` URLs are not handled.
- Only public posts embed. A private or members-only post renders an empty frame.
- No network access and no check that a post exists.
- `<youtube-cover>`: iOS Safari may need a second tap inside the player before
  sound plays.
- `<youtube-cover>`: a video whose owner disabled embedding shows YouTube's
  "Video unavailable" after the click; the cover can't tell beforehand.
- `<youtube-cover>`: `cover` must be an absolute URL. Strapi's local upload
  provider returns relative `/uploads/…` URLs, which are ignored; the site
  prefixes its Strapi origin first.
- The `/jsx` types cover the default tag name `youtube-cover` only. A site that
  calls `defineYoutubeCover("other-name")` declares that name itself.

## Upgrading to 1.2.1

No code change needed. Two fixes:

- **`linkedInEmbedSrc`** reads only the path of a pasted URL or `src`. 1.2.0
  also read the query and hash, so
  `…/urn:li:activity:7503697686274031617/?utm_campaign=share-12345` embedded
  `urn:li:share:12345`. For http(s) URLs only the parsed path is matched now,
  so urn-like text in the host, query or hash, or in path segments that URL
  parsing normalises away, no longer counts.
- **`<youtube-cover>`** inside a closed shadow root no longer stops its own
  player straight after it starts.

## Upgrading to 1.2

Purely additive; nothing changes for 1.1 callers. New: the optional `cover`
attribute on `<youtube-cover>`, and `cover?: string` in the `/jsx` types.
Without `cover`, the element renders, falls back and plays exactly as in 1.1.
The package still has no dependencies.

## Upgrading to 1.1

Purely additive; nothing changes for 1.0 callers. Every 1.0 export keeps its
signature and output. New: `youtubeThumbnailSrc`, `youtubePlayerSrc` and
`isMissingYoutubeThumbnail` on the main entry, the `/youtube-cover` entry with
`defineYoutubeCover`, and the types-only `/jsx` entry. The main entry still
uses no DOM APIs, and the package still has no dependencies.

## Development

```bash
npm test -w social-embed-utils     # vitest — 274 tests across 4 files, 4 type tests included, under 1 s
npm run build -w social-embed-utils
```

`src/__fixtures__/SocialMediaPosts-pilot.ts` is the pilot's parsers and message
handler, copied byte-for-byte apart from `export` and `return null`. The tests
run every real pharmtech CMS value through both and require the same output.
Each difference listed above has its own test that asserts the pilot's output
and the package's output side by side. The pilot had no YouTube parsing, so the
YouTube tests pin the real CMS values, every accepted shape and each rejected
input directly.

`src/__fixtures__/youtube-stopgap.ts` is pharmtech's thumbnail helper from the
click-to-play stopgap, copied byte-for-byte apart from `export`.
`youtubeThumbnailSrc` must match it, and `youtubePlayerSrc` must match the
stopgap's `` `${src}?autoplay=1&rel=0` ``, for every CMS video.

`src/youtube-cover.test.ts` runs `<youtube-cover>` in happy-dom with iframe
page loading switched off, so no test touches the network.
`src/youtube-cover.ssr.test.ts` imports the entry in plain Node, and
`src/jsx.test-d.ts` checks the `/jsx` types through `--typecheck`.

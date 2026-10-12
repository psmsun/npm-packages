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

## Install

```bash
npm install @prismetic/social-embed-utils
```

## Requirements

| | |
| --- | --- |
| Dependencies | none |
| Peer dependencies | **none at all**, not even React |
| Module format | ESM |
| Side effects | none at import; `package.json` declares `"sideEffects": false` |
| Environment | Node or browser; no DOM APIs used |

The UI, styling and CMS mapping stay in the site. This package only computes
strings and numbers.

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
only. Otherwise it is read from the whole trimmed text. A `src` with no id
returns `null`. The URL is always rebuilt on `www.linkedin.com`; the pasted URL
is never passed through.

| Pasted | Output |
| --- | --- |
| "Embed this post" snippet, `src=".../urn:li:share:7501237627262795776?collapsed=1"` | `.../urn:li:share:7501237627262795776?compact=1` |
| `urn:li:share:7498268744561868800` | `.../urn:li:share:7498268744561868800?compact=1` |
| `https://www.linkedin.com/feed/update/urn:li:activity:7503697686274031617/` | `.../urn:li:activity:7503697686274031617?compact=1` |
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

## Development

```bash
npm test -w social-embed-utils     # vitest — 135 tests, under 1 s
npm run build -w social-embed-utils
```

`src/__fixtures__/SocialMediaPosts-pilot.ts` is the pilot's parsers and message
handler, copied byte-for-byte apart from `export` and `return null`. The tests
run every real pharmtech CMS value through both and require the same output.
Each difference listed above has its own test that asserts the pilot's output
and the package's output side by side. The pilot had no YouTube parsing, so the
YouTube tests pin the real CMS values, every accepted shape and each rejected
input directly.

# @psmsun/video-utils

Lightweight, zero-dependency utilities for extracting YouTube and VK video IDs from any URL format.

## Installation

```bash
npm install @psmsun/video-utils
```

---

## `extractYoutubeID(input)`

Extracts an 11-character YouTube video ID from any URL format, or returns a bare ID as-is.

```js
import { extractYoutubeID } from "@psmsun/video-utils";

extractYoutubeID("dQw4w9WgXcQ");
// → "dQw4w9WgXcQ"

extractYoutubeID("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
// → "dQw4w9WgXcQ"

extractYoutubeID("https://youtu.be/dQw4w9WgXcQ");
// → "dQw4w9WgXcQ"

extractYoutubeID("https://youtube.com/shorts/dQw4w9WgXcQ");
// → "dQw4w9WgXcQ"

extractYoutubeID("https://www.youtube.com/live/dQw4w9WgXcQ");
// → "dQw4w9WgXcQ"

extractYoutubeID(null);
// → null
```

**Supported formats:**
- Bare ID (`dQw4w9WgXcQ`)
- `youtube.com/watch?v=ID`
- `youtu.be/ID`
- `youtube.com/embed/ID`
- `youtube.com/shorts/ID`
- `youtube.com/live/ID`

---

## `extractVKIDs(input)`

Extracts VK video `oid` and `id` from any VK video URL format or raw ID string.

Returns `{ oid: string, id: string }` or `null`.

```js
import { extractVKIDs } from "@psmsun/video-utils";

extractVKIDs("-178652725_456239064");
// → { oid: "-178652725", id: "456239064" }

extractVKIDs("https://vk.com/video-144893972_456246327");
// → { oid: "-144893972", id: "456246327" }

extractVKIDs("https://vk.com/video_ext.php?oid=-178652725&id=456239064&hash=abc");
// → { oid: "-178652725", id: "456239064" }

extractVKIDs("https://vk.com/clip-12345678_456239123");
// → { oid: "-12345678", id: "456239123" }

extractVKIDs(null);
// → null
```

**Supported formats:**
- Raw `oid_id` or `-oid_id`
- `vk.com/video_ext.php?oid=...&id=...`
- `vk.com/video{oid}_{id}`
- `vk.com/clip{oid}_{id}`
- Query string fragment `oid=...&id=...`

---

## Updating your projects

Replace the local import wherever you have it:

```diff
- import { extractVKIDs, extractYoutubeID } from "@/lib/videoIdUtils";
+ import { extractVKIDs, extractYoutubeID } from "@psmsun/video-utils";
```

---

## License

MIT

// ─── YouTube ─────────────────────────────────────────────────────────────────
// Handles:
//   dQw4w9WgXcQ
//   https://www.youtube.com/watch?v=dQw4w9WgXcQ
//   https://youtu.be/dQw4w9WgXcQ
//   https://www.youtube.com/embed/dQw4w9WgXcQ
//   https://youtube.com/shorts/dQw4w9WgXcQ
//   https://www.youtube.com/live/dQw4w9WgXcQ

export function extractYoutubeID(input) {
  if (!input) return null;

  const str = input.trim();

  // Already a bare ID (11 chars, no slashes or spaces)
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;

  try {
    const url = new URL(str);

    // youtu.be/ID
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null;
    }

    // youtube.com/watch?v=ID
    const v = url.searchParams.get("v");
    if (v) return v;

    // youtube.com/embed/ID  |  /shorts/ID  |  /live/ID
    const match = url.pathname.match(
      /\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/
    );
    if (match) return match[1];
  } catch {
    // Not a valid URL — try regex fallback
    const match = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}

// ─── VK ──────────────────────────────────────────────────────────────────────
// Handles:
//   4312321_3217563                                           (raw oid_id, user video)
//   -178652725_456239064                                      (raw oid_id, group video)
//   https://vk.com/video_ext.php?oid=-178652725&id=456239064&hash=...
//   https://vk.com/video-144893972_456246327                  (group: oid is negative)
//   https://vk.com/video215336036_165406371                   (user: oid is positive)
//   https://vk.com/clip-12345678_456239123
//   oid=-178652725&id=456239064&hash=...                      (query string fragment)
//
// Returns { oid: string, id: string } with correct sign on oid, or null.

const negateOid = (oid) => oid.startsWith("-") ? oid : `-${oid}`;
export function extractVKIDs(input) {
  if (!input) return null;


  const str = input.trim();

  // ── 1. Full URL ────────────────────────────────────────────────────────────
  if (str.startsWith("http")) {
    try {
      const url = new URL(str);

      // video_ext.php?oid=-178652725&id=456239064
      if (url.pathname.includes("video_ext.php")) {
        const oid = url.searchParams.get("oid");
        const id = url.searchParams.get("id");
        if (oid && id) return { oid: negateOid(oid), id };
      }

      // /video-144893972_456246327  or  /video215336036_165406371
      // /clip-12345678_456239123
      const pathMatch = url.pathname.match(
        /\/(?:video|clip)(-?\d+)_(\d+)/
      );
      if (pathMatch) {
        return { oid: negateOid(pathMatch[1]), id: pathMatch[2] };
      }
    } catch {
      // fall through
    }
  }

  // ── 2. Query-string fragment  oid=-178652725&id=456239064&hash=... ─────────
  if (str.includes("oid=") && str.includes("id=")) {
    const params = new URLSearchParams(str);
    const oid = params.get("oid");
    const id = params.get("id");
    if (oid && id) return { oid: negateOid(oid), id };
  }

  // ── 3. Raw  oid_id  or  -oid_id ───────────────────────────────────────────
  const rawMatch = str.match(/^(-?\d+)_(\d+)$/);
  if (rawMatch) return { oid: negateOid(rawMatch[1]), id: rawMatch[2] };

  return null;
}

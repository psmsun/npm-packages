const INSTAGRAM_ORIGIN = /^https:\/\/(www\.)?instagram\.com$/;

export const INSTAGRAM_CROP: Readonly<{ header: number; belowMedia: number }> =
  Object.freeze({ header: 54, belowMedia: 154 });

export const INSTAGRAM_PLACEHOLDER_HEIGHT: number = 560;

export const instagramCardHeight = (frameHeight: number): number =>
  frameHeight - INSTAGRAM_CROP.header - INSTAGRAM_CROP.belowMedia;

export const instagramEmbedSrc = (
  pasted: string | null | undefined,
): string | null => {
  if (typeof pasted !== "string") return null;

  const text = pasted.trim();
  // The permalink names the post the embed code was made for; a src= beside it is a script or media URL.
  const src =
    text.match(/data-instgrm-permalink="([^"]+)"/)?.[1] ??
    text.match(/src="([^"]*\/(?:p|reel|reels|tv)\/[^"]+)"/)?.[1] ??
    text;

  const post = src.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!post) return null;

  // A share sheet hands out "reels"; only "reel" is a valid embed path.
  const kind = post[1] === "reels" ? "reel" : post[1];
  return `https://www.instagram.com/${kind}/${post[2]}/embed/`;
};

export const readInstagramMeasure = (event: {
  origin: string;
  data: unknown;
}): number | null => {
  if (!INSTAGRAM_ORIGIN.test(event.origin)) return null;

  let payload = event.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (typeof payload !== "object" || payload === null) return null;

  const { type, details } = payload as {
    type?: unknown;
    details?: { height?: unknown } | null;
  };
  if (type !== "MEASURE") return null;

  const height = details?.height;
  return typeof height === "number" && Number.isFinite(height) && height > 0
    ? height
    : null;
};

// Oracle: pharmtech components/SocialMediaPosts.tsx lines 41–68 and 124–134, uncommitted pilot, read 2026-10-09.

export const linkedInSrc = (text: string) => {
  const src =
    text.match(/src="([^"]+)"/)?.[1] ??
    (text.includes("/embed/feed/update/") ? text : null);
  if (src) return `${src.split("?")[0]}?compact=1`;

  // The urn type is preserved: a ugcPost id addressed as urn:li:activity: resolves to a different post or to nothing.
  const urn = text.match(/(activity|ugcPost|share)[:-](\d{5,})/);
  return urn
    ? `https://www.linkedin.com/embed/feed/update/urn:li:${urn[1]}:${urn[2]}?compact=1`
    : null;
};

export const instagramSrc = (text: string) => {
  const src =
    // The permalink is read before any src=, because the pasted blockquote's only src= is its <script src="//www.instagram.com/embed.js">.
    text.match(/data-instgrm-permalink="([^"]+)"/)?.[1] ??
    text.match(/src="([^"]*\/(?:p|reel|reels|tv)\/[^"]+)"/)?.[1] ??
    text;
  if (/\/embed(\/|\?|$)/.test(src)) return src;

  // "reels" is what a share sheet hands you; only "reel" is a valid embed path.
  const post = src.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!post) return null;

  const kind = post[1] === "reels" ? "reel" : post[1];
  return `https://www.instagram.com/${kind}/${post[2]}/embed/`;
};

export const pilotMeasure = (event: { origin: string; data: any }) => {
      if (!/^https:\/\/(www\.)?instagram\.com$/.test(event.origin)) return null;

      let height: number | undefined;
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type !== "MEASURE") return null;
        height = payload.details?.height;
      } catch {
        return null;
      }
      if (!height) return null;
  return height;
};

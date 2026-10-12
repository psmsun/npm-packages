// The urn type is kept as written: a ugcPost id addressed as activity resolves to a different post or nothing.
const URN = /(activity|ugcPost|share)[:-](\d{5,})/g;

export const linkedInEmbedSrc = (
  pasted: string | null | undefined,
): string | null => {
  if (typeof pasted !== "string") return null;

  const text = pasted.trim();
  const scope = text.match(/src="([^"]+)"/)?.[1] ?? text;

  // A permalink slug is built from the post's words and comes before the real id, so the last match wins.
  const urns = [...scope.matchAll(URN)];
  const urn = urns[urns.length - 1];
  if (!urn) return null;

  // compact=1 is LinkedIn's media-only embed: no header, text or action bar.
  return `https://www.linkedin.com/embed/feed/update/urn:li:${urn[1]}:${urn[2]}?compact=1`;
};

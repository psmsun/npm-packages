const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const videoId = (url: URL): string | null | undefined => {
  if (url.hostname === "youtu.be") return url.pathname.split("/")[1];
  if (url.pathname === "/watch") return url.searchParams.get("v");
  return url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
};

export const youtubeEmbedSrc = (
  pasted: string | null | undefined,
): string | null => {
  if (typeof pasted !== "string") return null;

  const text = pasted.trim();
  const src = text.match(/src="([^"]+)"/)?.[1] ?? text;

  let url: URL;
  try {
    // Older YouTube embed code uses a protocol-relative src.
    url = new URL(src.startsWith("//") ? `https:${src}` : src);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname)) return null;

  const id = videoId(url);
  // "videoseries" is the 11-character path of a playlist embed, not a video.
  if (!id || !VIDEO_ID.test(id) || id === "videoseries") return null;

  return `https://www.youtube.com/embed/${id}`;
};

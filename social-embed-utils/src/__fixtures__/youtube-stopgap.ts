// Oracle: pharmtech components/SocialMediaPosts.tsx lines 37–38, uncommitted stopgap, read 2026-10-12.

export const youtubeThumbnail = (embed: string, size: "maxresdefault" | "hqdefault") =>
  `${embed.replace("www.youtube.com/embed/", "i.ytimg.com/vi/")}/${size}.jpg`;

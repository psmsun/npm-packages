import { instagramEmbedSrc } from "./instagram.js";
import { linkedInEmbedSrc } from "./linkedin.js";
import { youtubeEmbedSrc } from "./youtube.js";

export const socialEmbedSrc = (
  network: "linkedin" | "instagram" | "youtube",
  pasted: string | null | undefined,
): string | null => {
  if (network === "linkedin") return linkedInEmbedSrc(pasted);
  if (network === "instagram") return instagramEmbedSrc(pasted);
  if (network === "youtube") return youtubeEmbedSrc(pasted);
  return null;
};

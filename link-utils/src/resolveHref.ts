import { withScheme } from "./externalUrl.js";

/**
 * Everything a link element needs once a raw CMS href has been normalised.
 * `prefetch` is `undefined` for real routes so next/link keeps its default.
 */
export interface ResolvedHref {
  href: string;
  target: string;
  rel?: string;
  prefetch?: false;
}

// Function to clean and validate URLs
const cleanUrl = (url?: string): string => {
  if (!url) return "/";

  // Trim spaces from the URL
  const trimmedUrl = url.trim();

  // Handle empty strings after trimming
  if (trimmedUrl === "") return "/";

  // Remove leading slash if followed by http(s)
  if (trimmedUrl.match(/^\/https?:\/\//)) {
    return trimmedUrl.substring(1);
  }

  // Clean any potential double slashes in the protocol
  return trimmedUrl.replace(/([^:]\/)\/+/g, "$1");
};

// Function to check if it's an external link
const isExternalLink = (url: string): boolean => {
  return (
    url.match(
      /^(https?:\/\/|\/\/|mailto:|tel:|sms:|ftp:|sftp:|file:|skype:|whatsapp:|slack:|zoommtg:|spotify:|steam:|data:|blob:|ws:|wss:)/,
    ) !== null ||
    url.startsWith("#") ||
    url.includes("://")
  );
};

// Determine if link should open in new tab
const shouldOpenNewTab = (url: string): boolean => {
  return url.match(/^(https?:\/\/|\/\/)/) !== null;
};

// A CMS link can point at a static file (sitemap.xml, a PDF) rather than a
// route. next/link prefetches an RSC payload for a same-origin href, and the
// static export has no route directory for a file, so every page view fires
// a 404. Leave real routes on the default prefetch behaviour.
const STATIC_FILE =
  /\.(?:xml|pdf|txt|json|csv|zip|rss|docx?|xlsx?|pptx?|ics|jpe?g|png|gif|svg|webp|avif|mp4|webm|mp3)$/i;

/**
 * Normalises a raw CMS href into the props a link element needs.
 *
 * Extracted verbatim from the NavigationLink component every ITE site carries,
 * so the resolution is unchanged: bare hostnames gain a scheme, a `/https://…`
 * typo is repaired, external links open in a new tab with `rel`, and a link to
 * a static file opts out of next/link prefetching.
 *
 * Note this deliberately does NOT apply `withTrailingSlash` — matching the
 * existing per-site behaviour. Changing that affects every internal link on a
 * site and belongs in its own change.
 *
 * @param href   the raw value, typically straight from Strapi
 * @param target an explicit target that overrides the computed one
 */
export const resolveHref = (href?: string, target?: string): ResolvedHref => {
  // A CMS value like "mosbuild.com" carries no scheme, so it would otherwise
  // read as an internal path and be rewritten to "/mosbuild.com". Normalise
  // first so the external and new-tab checks below see the real URL.
  const cleanedHref = withScheme(cleanUrl(href));

  // Format href based on conditions
  const formattedHref = isExternalLink(cleanedHref)
    ? cleanedHref // Keep external links as is
    : cleanedHref.startsWith("/")
      ? cleanedHref
      : `/${cleanedHref}`;

  // Set default target for external links if not specified
  const finalTarget =
    target || (shouldOpenNewTab(cleanedHref) ? "_blank" : "_self");

  const resolved: ResolvedHref = {
    href: formattedHref,
    target: finalTarget,
  };

  // Add security attributes for external links
  if (finalTarget === "_blank") resolved.rel = "noopener noreferrer";

  if (STATIC_FILE.test(formattedHref.split(/[?#]/)[0])) resolved.prefetch = false;

  return resolved;
};

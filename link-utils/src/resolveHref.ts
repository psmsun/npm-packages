import { FILE_EXTENSION, withScheme } from "./externalUrl.js";

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

// A browser ignores whitespace and control characters in a scheme: "java\tscript:" is live.
const UNSAFE_SCHEME = /^(?:javascript|vbscript):/i;
const IGNORED_IN_SCHEME = /[\s\u0000-\u001f\u007f]/gu;

const isUnsafe = (url: string): boolean =>
  UNSAFE_SCHEME.test(url.replace(IGNORED_IN_SCHEME, ""));

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// Path only: a query string or a full URL can legitimately carry "//".
const collapseSlashes = (url: string): string => {
  if (SCHEME.test(url) || url.startsWith("//")) return url;

  const cut = url.search(/[?#]/);
  const path = cut === -1 ? url : url.slice(0, cut);
  const rest = cut === -1 ? "" : url.slice(cut);

  return path.replace(/([^:]\/)\/+/g, "$1") + rest;
};

// Function to clean and validate URLs
const cleanUrl = (url?: string): string => {
  if (!url) return "/";

  // Trim spaces from the URL
  const trimmedUrl = url.trim();

  // Handle empty strings after trimming, and resolve unsafe schemes the same way
  if (trimmedUrl === "" || isUnsafe(trimmedUrl)) return "/";

  // Remove leading slash if followed by http(s)
  if (trimmedUrl.match(/^\/https?:\/\//i)) {
    return trimmedUrl.substring(1);
  }

  return collapseSlashes(trimmedUrl);
};

// Function to check if it's an external link
const isExternalLink = (url: string): boolean => {
  return (
    url.match(
      /^(https?:\/\/|\/\/|mailto:|tel:|sms:|ftp:|sftp:|file:|skype:|whatsapp:|slack:|zoommtg:|spotify:|steam:|data:|blob:|ws:|wss:)/i,
    ) !== null ||
    url.startsWith("#") ||
    url.includes("://")
  );
};

// Determine if link should open in new tab
const shouldOpenNewTab = (url: string): boolean => {
  return url.match(/^(https?:\/\/|\/\/)/i) !== null;
};

/**
 * Normalises a raw CMS href into the props a link element needs.
 *
 * Extracted from the NavigationLink component every ITE site carries: bare
 * hostnames gain a scheme, a `/https://…` typo is repaired, external links open
 * in a new tab with `rel`, and a link to a static file opts out of next/link
 * prefetching. Since 1.0.1 a `javascript:` or `vbscript:` href resolves to "/"
 * and scheme matching ignores case.
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

  // A CMS link can point at a static file (sitemap.xml, a PDF) rather than a
  // route. next/link prefetches an RSC payload for a same-origin href, and the
  // static export has no route directory for a file, so every page view fires
  // a 404. Leave real routes on the default prefetch behaviour.
  if (FILE_EXTENSION.test(formattedHref.split(/[?#]/)[0])) resolved.prefetch = false;

  return resolved;
};

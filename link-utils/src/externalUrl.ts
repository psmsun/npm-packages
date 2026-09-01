/**
 * CMS link fields are often filled in as bare hostnames ("mosbuild.com",
 * "summit.rosupack.com") instead of full URLs. Without a scheme those read as
 * relative paths, so they get resolved against this site and 404.
 *
 * A value is treated as a domain when its first segment looks like a hostname
 * and does not end in a known file extension — so "brochure.pdf" stays internal.
 */

const FILE_EXTENSION =
  /\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|png|jpe?g|gif|svg|webp|avif|ico|mp4|webm|mp3|xml|json)$/i;

const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export const isBareDomain = (url: string): boolean => {
  if (!url || url.startsWith("/") || url.startsWith("#")) return false;
  if (url.includes("://")) return false;

  const host = url.split(/[/?#]/)[0];
  if (!host.includes(".") || FILE_EXTENSION.test(host)) return false;

  return HOSTNAME.test(host);
};

/** Prefixes https:// when the value is a bare domain; otherwise returns it unchanged. */
export const withScheme = (url: string): string =>
  isBareDomain(url) ? `https://${url}` : url;

/**
 * A consuming site is built with `trailingSlash: true`, so every internal page
 * URL ends in a slash. A CMS redirect destination stored without one lands on a
 * URL the host then 302s to the canonical form — an extra hop on every redirect.
 * Stray whitespace is trimmed too: a destination saved as "/sectors " is a
 * 404, not a redirect.
 * External URLs, static files, query strings and hashes are left alone.
 */
export const withTrailingSlash = (url: string): string => {
  const clean = url.trim();
  if (!clean.startsWith("/")) return clean;

  const cut = clean.search(/[?#]/);
  const path = cut === -1 ? clean : clean.slice(0, cut);
  const rest = cut === -1 ? "" : clean.slice(cut);

  if (path.endsWith("/") || FILE_EXTENSION.test(path)) return clean;

  return `${path}/${rest}`;
};

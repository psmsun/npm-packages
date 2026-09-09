/**
 * Validation for a CMS-supplied `canonicalURL`.
 *
 * Its own module because both entry points use it: `./bilingual` always, and the main
 * entry when a site opts in with `canonicalPolicy: "strict-same-origin"` (default
 * "passthrough", which leaves 2.0 behaviour alone).
 * Keep it free of locale knowledge — callers pass the URLs a sub-page must not claim.
 */

export interface SameOriginCanonicalOptions {
  /** Site origin, trailing slashes already stripped. */
  siteUrl: string;
  /** The page's path below any locale segment. Empty string on a home page. */
  pathSegment: string;
  /**
   * URLs a sub-path must not declare as its canonical. Normally the site root, plus the
   * locale home on a localized site. Ignored when `pathSegment` is empty.
   */
  homes?: readonly string[];
  /**
   * Where rejections go. Defaults to `console.error` — deliberately not `console.warn`,
   * because two of the four Red Sea sites build with `removeConsole: { exclude: ["error"] }`
   * and would compile out the very message this exists to emit.
   */
  onReject?: (message: string) => void;
}

/**
 * Accepts a CMS canonical only when it is an absolute URL on this site's own scheme and
 * host, and is not a home page being claimed by a sub-path. Returns `null` otherwise, so
 * the caller falls back to the computed per-path canonical.
 *
 * A rejected value is never worse than the computed one, and an unchecked one can be much
 * worse: `seoteam@acronym.com` was pasted into this field and shipped as
 * `<link rel="canonical" href="https://site/seoteam@acronym.com">` on two production sites,
 * because a bare string resolves against `metadataBase`. Relative values are rejected for
 * the same reason — telling a valid path from a typo'd one is exactly what failed there.
 */
export function sanitizeSameOriginCanonical(
  raw: unknown,
  options: SameOriginCanonicalOptions,
): string | null {
  const reject = options.onReject ?? ((m: string) => console.error(m));

  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  // Nothing was typed, so there is nothing to report.
  if (!trimmed) return null;

  const siteUrl = options.siteUrl.replace(/\/+$/, "");
  let base: URL;
  try {
    base = new URL(siteUrl);
  } catch {
    return null;
  }

  let candidate: URL;
  try {
    candidate = new URL(trimmed);
  } catch {
    reject(
      `[seo] Ignoring malformed CMS canonicalURL ${JSON.stringify(trimmed)}; using the page's own URL instead.`,
    );
    return null;
  }

  if (candidate.protocol !== "https:" && candidate.protocol !== "http:") {
    reject(
      `[seo] Ignoring CMS canonicalURL with unsupported protocol ${JSON.stringify(trimmed)}.`,
    );
    return null;
  }
  if (candidate.protocol !== base.protocol) {
    reject(
      `[seo] Ignoring CMS canonicalURL ${JSON.stringify(trimmed)}; expected scheme ${base.protocol}. An http canonical is never upgraded silently.`,
    );
    return null;
  }
  if (candidate.host !== base.host) {
    reject(
      `[seo] Ignoring off-site CMS canonicalURL ${JSON.stringify(trimmed)}; expected host ${base.host}.`,
    );
    return null;
  }

  // A page that declares the homepage as its canonical de-indexes itself. Sites that once
  // filled every SEO record from the homepage left that value behind on real pages.
  if (options.pathSegment) {
    const stripped = trimmed.replace(/\/+$/, "");
    const homes = options.homes ?? [siteUrl];
    if (homes.some((home) => home.replace(/\/+$/, "") === stripped)) {
      reject(
        `[seo] Ignoring CMS canonicalURL ${JSON.stringify(trimmed)} on sub-path ${JSON.stringify(`/${options.pathSegment}`)}; a page must not declare the homepage as its canonical.`,
      );
      return null;
    }
  }

  return candidate.toString();
}

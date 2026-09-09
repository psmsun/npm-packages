/**
 * Next.js App Router metadata for a site whose URLs carry a locale segment
 * (`/en/dining/`, `/ar/dining/`) — the Red Sea fleet.
 *
 * A separate entry point from `.` on purpose. The 27 single-language ITE sites keep
 * `createSeo` exactly as it is; nothing here can move a byte of their output, because
 * nothing here is reachable from that module.
 *
 * This entry is always strict: a CMS canonical must be absolute, same scheme and host, and
 * not a home page claimed by a sub-path; `noIndex` is read from an explicit allowlist plus
 * `metaRobots`. Those are the four sites' existing behaviour, so there is no policy option
 * to get wrong.
 *
 * No React import, so `next-sitemap` and other Node contexts can load it.
 */

import { sanitizeSameOriginCanonical } from "./canonical.js";
import { parseNoIndex } from "./noIndex.js";

export type { NoIndexVerdict } from "./noIndex.js";
export { parseNoIndex } from "./noIndex.js";
export type { SameOriginCanonicalOptions } from "./canonical.js";
export { sanitizeSameOriginCanonical } from "./canonical.js";

/** URL locale segments and how they map onto Open Graph locales. */
export interface BilingualLocales {
  /** Locale segments in hreflang order, e.g. ["en", "ar"]. */
  all: readonly string[];
  /** Segment used for x-default, and for a locale that is not in `all`. */
  default: string;
  /** Locale segment → Open Graph locale, e.g. { en: "en_US", ar: "ar_SA" }. */
  ogLocale?: Record<string, string>;
}

/** Last-resort title/description for one locale. */
export interface BilingualLocaleDefaults {
  title?: string;
  description?: string;
}

/** An env var that, when it holds `equals`, makes the whole build noindex. */
export interface HiddenBuildEnvRule {
  name: string;
  equals: string;
}

export interface BilingualSeoConfig {
  /** Site origin, e.g. "https://www.shebara.sa". A trailing slash is stripped. */
  siteUrl: string;
  /** Last-resort page title, behind the per-locale default. */
  siteName: string;
  /** Locale segments. Required — this entry exists for localized URLs. */
  locales: BilingualLocales;
  /** Per-locale last-resort title/description. Keys are `locales.all` members. */
  defaults?: Record<string, BilingualLocaleDefaults>;
  /**
   * Fields `resolvePageSeo` may copy from the homepage when a page has no `seo` of its own.
   * Default `[]` — nothing is inherited.
   *
   * Never list `canonicalURL`, `JSON_LD` or `noIndex`. An inherited canonical makes every
   * page without its own SEO declare itself a duplicate of the homepage, and search engines
   * drop it — this was live, on five pages of one site and six of another. An inherited
   * `JSON_LD` makes every sub-page claim to be the resort entity. An inherited `noIndex`
   * means one tick on the homepage delists the whole site and empties the sitemap.
   */
  inherit?: readonly string[];
  /** Supplies the homepage's `seo` object. Required for `inherit` to do anything. */
  loadHomepageSeo?: (locale?: string) => Promise<unknown> | unknown;
  /**
   * Env vars that force the whole build noindex. Default `[]`, so no env var is read.
   * Looked up dynamically, which means Next's build-time inlining of `process.env.FOO`
   * does not apply — fine for `generateMetadata`, which runs in Node during the build,
   * but a rule here is invisible to client bundles.
   */
  hiddenBuildEnv?: readonly HiddenBuildEnvRule[];
}

/** The Strapi `seo` component as the four sites query it. */
export interface BilingualCmsSeo {
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | string[] | null;
  noIndex?: unknown;
  canonicalURL?: string | null;
  /** Strapi v5 is flat (`{ url }`); v4 wraps it (`{ data: { attributes: { url } } }`). */
  metaImage?: unknown;
  [key: string]: unknown;
}

export interface BilingualSeoRobots {
  index: boolean;
  follow: boolean;
  googleBot: { index: boolean; follow: boolean };
}

/**
 * Structurally assignable to Next's `Metadata`, so this module needs no `next` import.
 * Deliberately not the main entry's `SeoMetadata`: `keywords` is omitted here rather than
 * always emitted, and `alternates.languages` / `openGraph.alternateLocale` do not exist
 * there.
 */
export interface BilingualSeoMetadata {
  title: { absolute: string };
  description?: string;
  keywords?: string | string[];
  alternates: {
    canonical: string;
    languages: Record<string, string>;
  };
  openGraph: {
    title: string;
    description?: string;
    url: string;
    siteName: string;
    locale: string;
    alternateLocale?: string[];
    type: "website";
    images?: Array<{ url: string; width: number; height: number; alt: string }>;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description?: string;
    images?: string[];
  };
  robots: BilingualSeoRobots;
}

export type BilingualGenerateSEOMetadata = (
  seoData: BilingualCmsSeo | null | undefined,
  path?: string | null,
) => BilingualSeoMetadata;

export type BilingualResolvePageSeo = (
  pageSeo: unknown,
) => Promise<Record<string, unknown> | undefined>;

export interface BoundBilingualSeo {
  generateSEOMetadata: BilingualGenerateSEOMetadata;
  resolvePageSeo: BilingualResolvePageSeo;
}

export interface ForLocaleOptions {
  /**
   * Locales this page actually exists in. Defaults to every configured locale, which is
   * what the four sites do today. Pass a subset to stop advertising an hreflang alternate
   * for a translation that was never authored.
   */
  available?: readonly string[];
}

export interface BilingualSeo {
  forLocale(locale: string | undefined, options?: ForLocaleOptions): BoundBilingualSeo;
}

/**
 * The first argument that is a usable string.
 *
 * A six-line copy of the private helper of the same name in `seo.ts`, which stays
 * byte-identical to 2.0 and therefore cannot export it. CMS text fields are routinely
 * saved as a single space, which a plain `||` chain accepts as a value: that is how a
 * blank `<title>` shipped.
 */
function firstNonBlank(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

/**
 * Resolves the CMS `metaImage` to an absolute URL.
 *
 * Flat `url` first, matching the main entry. The v4 branches are reachable only when
 * `metaImage` carries a `data` object; the two v5 sites never have one and the two v4
 * sites never have a flat `url`, so no live record can distinguish the order — which is
 * exactly why it is pinned by a test rather than left to chance.
 */
function resolveImageUrl(baseUrl: string, metaImage: unknown): string | null {
  if (!metaImage || typeof metaImage !== "object") return null;
  const image = metaImage as Record<string, unknown>;

  const flat = image.url;
  let raw: unknown = typeof flat === "string" && flat ? flat : null;

  if (!raw) {
    const data = image.data as Record<string, unknown> | null | undefined;
    const attrs = data?.attributes as Record<string, unknown> | undefined;
    const nested = attrs?.url;
    if (typeof nested === "string" && nested) {
      raw = nested;
    } else {
      const formats = attrs?.formats as Record<string, unknown> | undefined;
      const large = formats?.large as Record<string, unknown> | undefined;
      if (typeof large?.url === "string" && large.url) raw = large.url;
    }
  }

  if (typeof raw !== "string" || !raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${baseUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

const NOINDEX_NOFOLLOW: BilingualSeoRobots = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export function createBilingualSeo(config: BilingualSeoConfig): BilingualSeo {
  const baseUrl = config.siteUrl.replace(/\/+$/, "");
  const { locales } = config;
  const localeDefaults = config.defaults ?? {};
  const inherit = config.inherit ?? [];
  const hiddenBuildEnv = config.hiddenBuildEnv ?? [];

  function buildHidesFromSearchEngines(): boolean {
    if (hiddenBuildEnv.length === 0) return false;
    if (typeof process === "undefined" || !process.env) return false;
    for (const rule of hiddenBuildEnv) {
      if (process.env[rule.name] === rule.equals) return true;
    }
    return false;
  }

  /** A locale that is not configured cannot appear in a URL; clamp it and say so. */
  function urlLocaleFor(locale: string | undefined): string {
    if (locale != null && locales.all.includes(locale)) return locale;
    if (locale != null) {
      console.error(
        `[seo] Unknown locale ${JSON.stringify(locale)}; falling back to ${JSON.stringify(locales.default)}. Configured locales: ${locales.all.join(", ")}.`,
      );
    }
    return locales.default;
  }

  /**
   * Strips wrapping slashes and any leading configured-locale segment — call sites pass
   * "dining", "/ar/dining/" and "en/dining" for the same page.
   */
  function cleanPathOf(path: string | null | undefined): string {
    let clean = (path ? path.trim() : "").replace(/^\/+|\/+$/g, "");
    if (clean) {
      const [head, ...rest] = clean.split("/");
      if (locales.all.includes(head)) clean = rest.join("/");
    }
    return clean;
  }

  function build(
    locale: string | undefined,
    available: readonly string[] | undefined,
    seoData: BilingualCmsSeo | null | undefined,
    path?: string | null,
  ): BilingualSeoMetadata {
    const urlLocale = urlLocaleFor(locale);
    const perLocale = localeDefaults[urlLocale];

    // firstNonBlank rather than `||`: a metaTitle saved as a single space is not a title,
    // and accepting it ships a blank <title> that no automated check notices.
    const metaTitle =
      firstNonBlank(seoData?.metaTitle) ||
      firstNonBlank(perLocale?.title) ||
      config.siteName;
    const metaDescription = firstNonBlank(
      seoData?.metaDescription,
      perLocale?.description,
    );
    const keywords = seoData?.keywords;
    const imageUrl = resolveImageUrl(baseUrl, seoData?.metaImage);

    const cleanPath = cleanPathOf(path);
    const pathSegment = cleanPath ? `/${cleanPath}` : "";
    const computedCanonical = `${baseUrl}/${urlLocale}${pathSegment}/`;

    const canonical =
      sanitizeSameOriginCanonical(seoData?.canonicalURL, {
        siteUrl: baseUrl,
        pathSegment: cleanPath,
        // On a bilingual site the homepage is /{locale}/, not the bare apex, which serves
        // nothing under `output: export`. Both count as a home.
        homes: [baseUrl, ...locales.all.map((l) => `${baseUrl}/${l}`)],
      }) ?? computedCanonical;

    const verdict = parseNoIndex(seoData);
    const robots: BilingualSeoRobots = buildHidesFromSearchEngines()
      ? NOINDEX_NOFOLLOW
      : verdict.noIndex
        ? {
            index: false,
            follow: verdict.follow,
            googleBot: { index: false, follow: verdict.follow },
          }
        : {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true },
          };

    const shown = available
      ? locales.all.filter((l) => available.includes(l))
      : locales.all;
    const href = (l: string) => withTrailingSlash(`${baseUrl}/${l}${pathSegment}`);
    const languages: Record<string, string> = {};
    for (const l of shown) languages[l] = href(l);
    const xDefault = shown.includes(locales.default) ? locales.default : shown[0];
    if (xDefault) languages["x-default"] = href(xDefault);

    const alternateLocale = shown
      .filter((l) => l !== urlLocale)
      .map((l) => locales.ogLocale?.[l])
      .filter((l): l is string => typeof l === "string");

    return {
      title: { absolute: metaTitle },
      ...(metaDescription ? { description: metaDescription } : {}),
      ...(keywords != null && keywords !== "" ? { keywords } : {}),
      alternates: {
        canonical,
        languages,
      },
      openGraph: {
        title: metaTitle,
        ...(metaDescription ? { description: metaDescription } : {}),
        url: canonical,
        siteName: firstNonBlank(perLocale?.title) || config.siteName,
        locale: locales.ogLocale?.[urlLocale] ?? "en_US",
        ...(alternateLocale.length ? { alternateLocale } : {}),
        type: "website",
        ...(imageUrl
          ? {
              images: [
                { url: imageUrl, width: 1200, height: 630, alt: metaTitle },
              ],
            }
          : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: metaTitle,
        ...(metaDescription ? { description: metaDescription } : {}),
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
      robots,
    };
  }

  /**
   * The `seo` object to render for a page.
   *
   * A page with its own `seo` keeps it untouched — including an empty `{}`, which stops
   * inheritance. That is the four sites' current behaviour, kept deliberately; whether an
   * empty CMS component should mean "no SEO record" is an open question for the content
   * team, not a code fix.
   *
   * Returning `undefined` is safe and preferred over a wrong value: the caller then
   * produces the correct per-path canonical, the correct hreflang set and the per-locale
   * defaults, and `JsonLd` renders nothing.
   */
  async function resolveFor(
    locale: string | undefined,
    pageSeo: unknown,
  ): Promise<Record<string, unknown> | undefined> {
    if (pageSeo && typeof pageSeo === "object") {
      return pageSeo as Record<string, unknown>;
    }
    if (inherit.length === 0 || !config.loadHomepageSeo) return undefined;

    const homepageSeo = await config.loadHomepageSeo(locale);
    if (!homepageSeo || typeof homepageSeo !== "object") return undefined;
    const source = homepageSeo as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const field of inherit) {
      if (source[field] != null) out[field] = source[field];
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  return {
    forLocale(locale, options = {}) {
      return {
        // (seoData, path) only. There is no pageData fallback chain here: none of the four
        // sites passes one, so porting the main entry's Title/Header.Title/PageName ladder
        // would be ~40 lines no call site reaches. A third argument is ignored.
        generateSEOMetadata: (seoData, path) =>
          build(locale, options.available, seoData, path),
        resolvePageSeo: (pageSeo) => resolveFor(locale, pageSeo),
      };
    },
  };
}

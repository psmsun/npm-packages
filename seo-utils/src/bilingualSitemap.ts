/**
 * next-sitemap helpers for a site whose routes carry a locale segment.
 *
 * Separate from `./sitemap` so that entry's `createSitemapNoIndex` — the redirects-URL
 * convention the 27 ITE sites use — stays exactly as it is.
 *
 * Node-only, no React, no top-level await, so `next-sitemap.config.js` can load it with a
 * plain `require()` through Node's require(esm) (Node 20.19+ / 22.12+).
 */

import { parseNoIndex } from "./noIndex.js";
import { type FetchLike, normalizeSitemapPath } from "./sitemap.js";

export { normalizeSitemapPath } from "./sitemap.js";
export type { FetchLike } from "./sitemap.js";
export type { NoIndexVerdict } from "./noIndex.js";
export { parseNoIndex } from "./noIndex.js";

/**
 * Which Strapi response shape a CMS returns. The fleet is not uniform, and a wrong value
 * fails silently: every `seo` reads `undefined`, nothing is excluded, and the sitemap ships
 * noIndex pages with no error. Hence the mismatch guard below.
 *   "v4" — rows are `{ id, attributes: {…} }`; populate uses `populate[seo]=true`.
 *   "v5" — rows are flat and carry `documentId`; populate uses `populate[0]=seo`.
 */
export type CmsShape = "v4" | "v5";

/** A Strapi single type and the URL segments it lives at, after `/{locale}/`. */
export interface SitemapSingleType {
  uid: string;
  segments: string[];
}

/** A Strapi collection and the field holding each row's path, served under `/{locale}/`. */
export interface SitemapCollection {
  uid: string;
  field: string;
  /** URL segment the field lives under. Omit when the field is already a path. */
  prefix?: string | null;
}

export interface LocaleSitemapNoIndexOptions {
  /** Strapi origin, e.g. "https://prod-shebara-cms.prismetic.com". */
  apiBase: string;
  /** Response shape of that box. */
  shape: CmsShape;
  /** Locale segments to walk, e.g. ["en", "ar"]. Defaults to ["en"]. */
  locales?: readonly string[];
  /** Single types and where they live in the URL. */
  singleTypes?: readonly SitemapSingleType[];
  /** Collections and the field holding each row's path. */
  collections?: readonly SitemapCollection[];
  /** Env var holding extra comma-separated paths to exclude, e.g. "SITEMAP_NOINDEX_PATHS". */
  extraPathsEnv?: string;
  /** Defaults to the global fetch. Injectable for tests. */
  fetch?: FetchLike;
}

export interface LocaleSitemapNoIndex {
  normalizeSitemapPath: typeof normalizeSitemapPath;
  /** Takes no argument, and caches on the configured base. */
  getNoIndexPathSetPromise(): Promise<Set<string>>;
}

function pathsFromEnvVar(name: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!name) return out;
  if (typeof process === "undefined" || !process.env) return out;
  for (const part of (process.env[name] || "").split(",")) {
    const n = normalizeSitemapPath(part.trim());
    if (n && n !== "/") out.add(n);
  }
  return out;
}

/**
 * Paths to omit from the sitemap because their Strapi SEO record says do-not-index.
 *
 * Filters client-side rather than with Strapi's `filters[seo][noIndex][$eq]=true`, because
 * `parseNoIndex` is broader than that filter: it also honours `metaRobots`, and the whole
 * point is that this set matches exactly the pages that render a noindex meta tag.
 */
export function createLocaleSitemapNoIndex(
  options: LocaleSitemapNoIndexOptions,
): LocaleSitemapNoIndex {
  const apiBase = String(options.apiBase).replace(/\/+$/, "");
  const { shape } = options;
  const locales = options.locales ?? ["en"];
  const singleTypes = options.singleTypes ?? [];
  const collections = options.collections ?? [];
  const doFetch: FetchLike = (url) =>
    options.fetch ? options.fetch(url) : globalThis.fetch(url);
  const populate =
    shape === "v4" ? "populate%5Bseo%5D=true" : "populate%5B0%5D=seo";

  /** v4 wraps every row in `attributes`; v5 rows are flat. */
  function unwrap(row: unknown): Record<string, unknown> | null {
    if (!row || typeof row !== "object") return null;
    const record = row as Record<string, unknown>;
    const inner = shape === "v4" ? record.attributes : record;
    return inner && typeof inner === "object"
      ? (inner as Record<string, unknown>)
      : null;
  }

  /**
   * A wrong `shape` fails silently: every `seo` reads `undefined`, nothing is ever
   * excluded, and the sitemap ships noIndex pages with no error. Say so.
   */
  function warnOnShapeMismatch(uid: string, row: unknown): void {
    if (!row || typeof row !== "object") return;
    const looksV4 = "attributes" in (row as Record<string, unknown>);
    if (looksV4 !== (shape === "v4")) {
      console.error(
        `[sitemap] shape is "${shape}" but ${uid} returned a ${looksV4 ? "v4" : "v5"}-shaped row; noIndex exclusions are being silently skipped.`,
      );
    }
  }

  function pathForSegments(locale: string, segments: string[]): string {
    const tail = segments && segments.length ? `/${segments.join("/")}` : "";
    return normalizeSitemapPath(`/${locale}${tail}`);
  }

  function pathForRow(locale: string, raw: unknown, prefix: string | null): string {
    const tail = String(raw || "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    if (!tail) return normalizeSitemapPath(`/${locale}`);
    const withPrefix = prefix ? `${prefix}/${tail}` : tail;
    return normalizeSitemapPath(`/${locale}/${withPrefix}`);
  }

  async function fetchJson(url: string): Promise<any> {
    try {
      const res = await doFetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("[sitemap] noIndex fetch failed:", url, e);
      return null;
    }
  }

  async function mergeForLocale(paths: Set<string>, locale: string): Promise<void> {
    for (const { uid, segments } of singleTypes) {
      const url = `${apiBase}/api/${uid}?locale=${encodeURIComponent(locale)}&${populate}`;
      const json = await fetchJson(url);
      warnOnShapeMismatch(uid, json?.data);
      if (parseNoIndex(unwrap(json?.data)?.seo).noIndex) {
        paths.add(pathForSegments(locale, segments));
      }
    }

    for (const { uid, field, prefix } of collections) {
      const url = `${apiBase}/api/${uid}?locale=${encodeURIComponent(locale)}&pagination%5BpageSize%5D=500&${populate}`;
      const json = await fetchJson(url);
      warnOnShapeMismatch(uid, json?.data?.[0]);
      for (const row of json?.data || []) {
        const attrs = unwrap(row);
        const slugPath = attrs?.[field];
        if (!slugPath) continue;
        if (parseNoIndex(attrs?.seo).noIndex) {
          paths.add(pathForRow(locale, slugPath, prefix ?? null));
        }
      }
    }
  }

  async function buildNoIndexPathSet(): Promise<Set<string>> {
    const paths = pathsFromEnvVar(options.extraPathsEnv);
    for (const locale of locales) {
      await mergeForLocale(paths, locale);
    }
    return paths;
  }

  let promise: Promise<Set<string>> | null = null;

  return {
    normalizeSitemapPath,
    getNoIndexPathSetPromise() {
      if (!promise) promise = buildNoIndexPathSet();
      return promise;
    },
  };
}

export interface AlternateRef {
  href: string;
  hreflang: string;
  hrefIsAbsolute: true;
}

export interface LocaleAlternateOptions {
  /** Locale used for x-default. Defaults to `locales[0]`. */
  xDefault?: string;
  /**
   * Whether a locale actually has this page. Default: every locale does, which reproduces
   * current fleet behaviour byte for byte.
   *
   * Without it the helper advertises an alternate for a translation that may not exist —
   * a live example is desertrock's `/ar/saudi-national-day-2025/`, emitted as an `ar`
   * alternate although no such file is exported and it is not in the sitemap's own `<loc>`
   * set. That non-reciprocity is what makes Google discard the whole cluster.
   */
  existsIn?: (locale: string, restPath: string) => boolean;
}

/**
 * hreflang alternates for one sitemap entry, for next-sitemap's `transform` hook.
 *
 * Every href gets a trailing slash: with `trailingSlash: true`, an href without one is not
 * the page's canonical and is not in this sitemap's own `<loc>` set, which is exactly the
 * non-reciprocity condition that makes Google drop the cluster.
 */
export function localeAlternateRefs(
  siteUrl: string,
  path: string,
  locales: readonly string[],
  options: LocaleAlternateOptions = {},
): AlternateRef[] {
  const base = String(siteUrl).replace(/\/+$/, "");
  const escaped = locales.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = String(path).match(new RegExp(`^/(${escaped.join("|")})(/.*)?$`));
  const restPath = match ? (match[2] ?? "/") : "/";

  const href = (locale: string) => {
    const url = `${base}/${locale}${restPath}`;
    return url.endsWith("/") ? url : `${url}/`;
  };

  const shown = options.existsIn
    ? locales.filter((l) => options.existsIn?.(l, restPath))
    : locales;

  const refs: AlternateRef[] = shown.map((locale) => ({
    href: href(locale),
    hreflang: locale,
    hrefIsAbsolute: true,
  }));

  const xDefault = options.xDefault ?? locales[0];
  if (xDefault && shown.includes(xDefault)) {
    refs.push({ href: href(xDefault), hreflang: "x-default", hrefIsAbsolute: true });
  }
  return refs;
}

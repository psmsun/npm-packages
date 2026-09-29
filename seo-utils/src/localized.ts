import {
  type CanonicalPolicy,
  type CmsPageData,
  type CmsSeo,
  createSeo,
  type NoIndexPolicy,
  type SeoMetadata,
} from "./seo.js";

export interface SeoLocale {
  prefix: string;
  ogLocale: string;
  hreflang: readonly string[];
  enabled?: boolean;
}

export interface LocalizedSeoConfig {
  siteUrl: string;
  siteName: string;
  canonicalPolicy?: CanonicalPolicy;
  noIndexPolicy?: NoIndexPolicy;
  defaultLocale: string;
  locales: Record<string, SeoLocale>;
}

export interface LocalizedSeoMetadata extends Omit<SeoMetadata, "alternates"> {
  alternates: { canonical: string; languages?: Record<string, string> };
}

export interface LocalizedMetadataOptions {
  alternates?: Record<string, string | null | undefined>;
}

export type LocalizedGenerateSEOMetadata = (
  seoData: CmsSeo | null | undefined,
  route?: string | null,
  pageData?: CmsPageData,
  options?: LocalizedMetadataOptions,
) => LocalizedSeoMetadata;

export interface LocalizedSeo {
  forLocale(locale: string): { generateSEOMetadata: LocalizedGenerateSEOMetadata };
  localizedRoute(route: string, locale: string): string;
  localizedUrl(route: string, locale: string): string;
}

function validate(config: LocalizedSeoConfig): void {
  const keys = Object.keys(config.locales);
  if (!keys.includes(config.defaultLocale)) {
    throw new Error(
      `[seo] defaultLocale ${JSON.stringify(config.defaultLocale)} is not one of the configured locales (${keys.join(", ")}).`,
    );
  }
  const prefixes = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const [key, locale] of Object.entries(config.locales)) {
    const name = `[seo] Locale ${JSON.stringify(key)}`;
    if (typeof locale.prefix !== "string") {
      throw new Error(`${name} needs a string prefix ("" for none); got ${JSON.stringify(locale.prefix)}.`);
    }
    if (locale.prefix.includes("/")) {
      throw new Error(
        `${name} has prefix ${JSON.stringify(locale.prefix)}; a prefix is one path segment, without "/".`,
      );
    }
    const sharing = prefixes.get(locale.prefix);
    if (sharing !== undefined) {
      throw new Error(
        locale.prefix
          ? `[seo] Locales ${JSON.stringify(sharing)} and ${JSON.stringify(key)} both use the prefix ${JSON.stringify(locale.prefix)}.`
          : `[seo] Locales ${JSON.stringify(sharing)} and ${JSON.stringify(key)} are both unprefixed; only one locale may have prefix "".`,
      );
    }
    prefixes.set(locale.prefix, key);
    if (!Array.isArray(locale.hreflang) || locale.hreflang.some((code) => typeof code !== "string")) {
      throw new Error(`${name} needs hreflang as an array of strings; got ${JSON.stringify(locale.hreflang)}.`);
    }
    if (locale.hreflang.length === 0 || locale.hreflang.some((code) => !code.trim())) {
      throw new Error(`${name} has an empty hreflang.`);
    }
    if (typeof locale.ogLocale !== "string" || !locale.ogLocale.trim()) {
      throw new Error(`${name} needs a non-blank ogLocale; got ${JSON.stringify(locale.ogLocale)}.`);
    }
    for (const code of locale.hreflang) {
      const owner = codes.get(code.toLowerCase());
      if (owner !== undefined && owner !== key) {
        throw new Error(
          `[seo] hreflang ${JSON.stringify(code)} is on both ${JSON.stringify(owner)} and ${JSON.stringify(key)}.`,
        );
      }
      codes.set(code.toLowerCase(), key);
    }
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function createLocalizedSeo(config: LocalizedSeoConfig): LocalizedSeo {
  validate(config);
  const baseUrl = config.siteUrl.replace(/\/+$/, "");
  const siteHost = hostOf(baseUrl);
  const locales = new Map(Object.entries(config.locales));
  const keys = [...locales.keys()];
  const unprefixed = keys.find((key) => locales.get(key)!.prefix === "");
  const generators = new Map(
    keys.map((key) => [
      key,
      createSeo({
        siteUrl: config.siteUrl,
        siteName: config.siteName,
        locale: locales.get(key)!.ogLocale,
        canonicalPolicy: config.canonicalPolicy,
        noIndexPolicy: config.noIndexPolicy,
      }).generateSEOMetadata,
    ]),
  );

  const prefixOf = (key: string) => locales.get(key)!.prefix;
  const isEnabled = (key: string) => locales.get(key)!.enabled !== false;

  function resolve(locale: string): string {
    if (locales.has(locale)) return locale;
    console.error(
      `[seo] Unknown locale ${JSON.stringify(locale)}; falling back to ${JSON.stringify(config.defaultLocale)}. Configured locales: ${keys.join(", ")}.`,
    );
    return config.defaultLocale;
  }

  function clean(route: string | null | undefined, key: string): string {
    const trimmed = (route ? route.trim() : "").replace(/^\/+|\/+$/g, "");
    const [head, ...rest] = trimmed.split("/");
    return prefixOf(key) && head === prefixOf(key) ? rest.join("/") : trimmed;
  }

  const pathOf = (key: string, route: string) =>
    [prefixOf(key), route].filter(Boolean).join("/");

  function urlOf(key: string, route: string): string {
    const path = pathOf(key, route);
    return `${baseUrl}/${path ? `${path}/` : ""}`;
  }

  function guard(
    seoData: CmsSeo | null | undefined,
    key: string,
    route: string,
  ): CmsSeo | null | undefined {
    const raw = seoData?.canonicalURL;
    if (!seoData || !siteHost || typeof raw !== "string" || !raw.trim()) return seoData;
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      return seoData;
    }
    if (url.host !== siteHost) return seoData;

    const path = url.pathname.replace(/\/+$/, "");
    const first = path.split("/")[1] ?? "";
    const owner = keys.find((k) => prefixOf(k) !== "" && prefixOf(k) === first) ?? unprefixed;
    let problem: string | null = null;
    if (owner !== key) {
      problem = owner === undefined
        ? "it is outside every locale"
        : `it belongs to locale ${JSON.stringify(owner)}`;
    } else if (route && prefixOf(key) && path === `/${prefixOf(key)}`) {
      problem = "a sub-page must not declare its locale home as its canonical";
    }
    if (!problem) return seoData;

    const page = pathOf(key, route);
    console.error(
      `[seo] Ignoring CMS canonicalURL ${JSON.stringify(raw)} on ${page ? `/${page}/` : "/"}; ${problem}.`,
    );
    return { ...seoData, canonicalURL: null };
  }

  function languagesFor(
    key: string,
    route: string,
    alternates: LocalizedMetadataOptions["alternates"],
  ): Record<string, string> | null {
    if (!alternates || !isEnabled(key)) return null;
    const routes = new Map<string, string>();
    for (const other of keys) {
      const alternate = alternates[other];
      if (other === key) routes.set(other, route);
      else if (isEnabled(other) && typeof alternate === "string") {
        routes.set(other, clean(alternate, other));
      }
    }
    if (routes.size < 2) return null;

    const languages: Record<string, string> = {};
    for (const [other, otherRoute] of routes) {
      for (const code of locales.get(other)!.hreflang) {
        languages[code] = urlOf(other, otherRoute);
      }
    }
    const defaultRoute = routes.get(config.defaultLocale);
    if (defaultRoute !== undefined) {
      languages["x-default"] = urlOf(config.defaultLocale, defaultRoute);
    }
    return languages;
  }

  return {
    forLocale(locale) {
      const key = resolve(locale);
      const generate = generators.get(key)!;
      return {
        generateSEOMetadata: (seoData, route, pageData, options) => {
          const cleanRoute = clean(route, key);
          const metadata = generate(
            guard(seoData, key, cleanRoute),
            pathOf(key, cleanRoute),
            pageData,
          );
          const languages = languagesFor(key, cleanRoute, options?.alternates);
          return languages
            ? { ...metadata, alternates: { ...metadata.alternates, languages } }
            : metadata;
        },
      };
    },
    localizedRoute(route, locale) {
      const key = resolve(locale);
      return pathOf(key, clean(route, key));
    },
    localizedUrl(route, locale) {
      const key = resolve(locale);
      return urlOf(key, clean(route, key));
    },
  };
}

export function alternatesFromLocalizations<
  T extends { locale: string; publishedAt?: string | null; [field: string]: any },
>(
  localizations: readonly T[] | null | undefined,
  toRoute: (localization: T) => string,
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const localization of localizations ?? []) {
    if (!localization?.publishedAt) continue;
    if (Object.prototype.hasOwnProperty.call(alternates, localization.locale)) continue;
    alternates[localization.locale] = toRoute(localization);
  }
  return alternates;
}

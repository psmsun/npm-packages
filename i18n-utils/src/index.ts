export interface LocaleDefinition {
  prefix: string;
  ogLocale: string;
  hreflang: readonly string[];
  enabled?: boolean;
  htmlLang?: string;
  label?: string;
}

export interface LocalesConfig<L extends string = string> {
  defaultLocale: string;
  locales: Record<L, LocaleDefinition>;
}

export interface LocalizeHrefOptions {
  exclude?: readonly string[];
}

export interface DefinedLocales<L extends string = string> extends LocalesConfig<L> {
  isLocaleEnabled(locale: L): boolean;
  enabledLocales(): L[];
  otherLocales(locale: L): L[];
  localizePath(path: string, locale: L): string;
  localizeHref(href: string, locale: L, options?: LocalizeHrefOptions): string;
  stripLocalePrefix(segments: string[], locale: L): string[];
  localeFromPath(pathname: string): L;
  htmlLangOf(locale: L): string;
  withLocale<T extends Record<string, unknown>>(
    variables: T | undefined,
    locale?: L,
  ): T | (T & { locale: L }) | undefined;
}

export type DictionaryShape<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => DictionaryShape<R>
    : T extends object
      ? { [K in keyof T]: DictionaryShape<T[K]> }
      : T;

function definitionOf<L extends string>(
  config: LocalesConfig<L>,
  locale: L,
): LocaleDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(config.locales, locale)
    ? config.locales[locale]
    : undefined;
}

export function isLocaleEnabled<L extends string>(config: LocalesConfig<L>, locale: L): boolean {
  const definition = definitionOf(config, locale);
  return definition !== undefined && definition.enabled !== false;
}

export function enabledLocales<L extends string>(config: LocalesConfig<L>): L[] {
  return (Object.keys(config.locales) as L[]).filter((locale) => isLocaleEnabled(config, locale));
}

export function otherLocales<L extends string>(config: LocalesConfig<L>, locale: L): L[] {
  return enabledLocales(config).filter((other) => other !== locale);
}

export function localizePath<L extends string>(
  config: LocalesConfig<L>,
  path: string,
  locale: L,
): string {
  const prefix = definitionOf(config, locale)?.prefix;
  if (!prefix || /^(?:[a-z][a-z\d+.-]*:|\/\/|[#?])/i.test(path)) return path;
  const rest = path.replace(/^\/+/, "");
  if (rest.split(/[/?#]/)[0] === prefix) return path;
  return `/${prefix}/${rest}`;
}

// Union of link-utils' prefetch and filename extension lists; a /cn/ twin of a public/ file is always a 404.
const STATIC_FILE =
  /\.(?:xml|pdf|txt|json|csv|zip|rar|rss|docx?|xlsx?|pptx?|ics|jpe?g|png|gif|svg|webp|avif|ico|mp4|webm|mp3)$/i;

function segmentsOf(href: string): string[] {
  return href.split(/[?#]/)[0].split("/").filter(Boolean);
}

export function localizeHref<L extends string>(
  config: LocalesConfig<L>,
  href: string,
  locale: L,
  options?: LocalizeHrefOptions,
): string {
  if (STATIC_FILE.test(href.split(/[?#]/)[0])) return href;
  const segments = segmentsOf(href);
  const excluded = (options?.exclude ?? []).some((entry) => {
    const prefix = segmentsOf(entry);
    return prefix.length > 0 && prefix.every((segment, i) => segments[i] === segment);
  });
  return excluded ? href : localizePath(config, href, locale);
}

export function stripLocalePrefix<L extends string>(
  config: LocalesConfig<L>,
  segments: string[],
  locale: L,
): string[] {
  const prefix = definitionOf(config, locale)?.prefix;
  return prefix && segments[0] === prefix ? segments.slice(1) : segments;
}

export function localeFromPath<L extends string>(config: LocalesConfig<L>, pathname: string): L {
  const first = pathname.split("/").filter(Boolean)[0];
  const enabled = enabledLocales(config);
  return (
    enabled.find((locale) => config.locales[locale].prefix !== "" && config.locales[locale].prefix === first) ??
    enabled.find((locale) => config.locales[locale].prefix === "") ??
    (config.defaultLocale as L)
  );
}

export function htmlLangOf<L extends string>(config: LocalesConfig<L>, locale: L): string {
  return definitionOf(config, locale)?.htmlLang || locale;
}

export function withLocale<T extends Record<string, unknown>, L extends string>(
  config: LocalesConfig<L>,
  variables: T | undefined,
  locale?: L,
): T | (T & { locale: L }) | undefined {
  return !locale || locale === config.defaultLocale
    ? variables
    : ({ ...variables, locale } as T & { locale: L });
}

function validate(config: LocalesConfig): void {
  const keys = Object.keys(config.locales);
  if (!keys.includes(config.defaultLocale)) {
    throw new Error(
      `[i18n] defaultLocale ${JSON.stringify(config.defaultLocale)} is not one of the configured locales (${keys.join(", ")}).`,
    );
  }
  const prefixes = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const [key, locale] of Object.entries(config.locales)) {
    const name = `[i18n] Locale ${JSON.stringify(key)}`;
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
          ? `[i18n] Locales ${JSON.stringify(sharing)} and ${JSON.stringify(key)} both use the prefix ${JSON.stringify(locale.prefix)}.`
          : `[i18n] Locales ${JSON.stringify(sharing)} and ${JSON.stringify(key)} are both unprefixed; only one locale may have prefix "".`,
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
          `[i18n] hreflang ${JSON.stringify(code)} is on both ${JSON.stringify(owner)} and ${JSON.stringify(key)}.`,
        );
      }
      codes.set(code.toLowerCase(), key);
    }
  }
}

export function defineLocales<L extends string>(config: LocalesConfig<L>): DefinedLocales<L> {
  validate(config);
  return {
    ...config,
    isLocaleEnabled: (locale) => isLocaleEnabled(config, locale),
    enabledLocales: () => enabledLocales(config),
    otherLocales: (locale) => otherLocales(config, locale),
    localizePath: (path, locale) => localizePath(config, path, locale),
    localizeHref: (href, locale, options) => localizeHref(config, href, locale, options),
    stripLocalePrefix: (segments, locale) => stripLocalePrefix(config, segments, locale),
    localeFromPath: (pathname) => localeFromPath(config, pathname),
    htmlLangOf: (locale) => htmlLangOf(config, locale),
    withLocale: (variables, locale) => withLocale(config, variables, locale),
  };
}

export function defineDictionaries<L extends string, D>(
  dictionaries: Record<L, D>,
): (locale: L) => D {
  return (locale) => dictionaries[locale];
}

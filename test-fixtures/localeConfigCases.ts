export interface LocaleConfigCase {
  name: string;
  defaultLocale: string;
  locales: Record<string, unknown>;
}

export interface InvalidLocaleConfigCase extends LocaleConfigCase {
  message: RegExp;
}

const en = { prefix: "", ogLocale: "en_US", hreflang: ["en"], htmlLang: "en", label: "EN" };
const zhCN = { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"], htmlLang: "zh-CN", label: "中文", enabled: true };
const MOSBUILD = { en, "zh-CN": zhCN };
const withRu = (ru: Record<string, unknown>) => ({ ...MOSBUILD, ru });

export const INVALID_LOCALE_CONFIGS: InvalidLocaleConfigCase[] = [
  {
    name: "a missing defaultLocale",
    defaultLocale: "zh-cn",
    locales: MOSBUILD,
    message: /^defaultLocale "zh-cn" is not one of the configured locales \(en, zh-CN\)\.$/,
  },
  {
    name: "a duplicate prefix",
    defaultLocale: "en",
    locales: withRu({ prefix: "cn", ogLocale: "ru_RU", hreflang: ["ru"] }),
    message: /^Locales "zh-CN" and "ru" both use the prefix "cn"\.$/,
  },
  {
    name: "two unprefixed locales",
    defaultLocale: "en",
    locales: withRu({ prefix: "", ogLocale: "ru_RU", hreflang: ["ru"] }),
    message: /^Locales "en" and "ru" are both unprefixed; only one locale may have prefix ""\.$/,
  },
  {
    name: "a prefix with a slash",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru/msk", ogLocale: "ru_RU", hreflang: ["ru"] }),
    message: /^Locale "ru" has prefix "ru\/msk"; a prefix is one path segment, without "\/"\.$/,
  },
  {
    name: "a missing prefix",
    defaultLocale: "en",
    locales: withRu({ ogLocale: "ru_RU", hreflang: ["ru"] }),
    message: /^Locale "ru" needs a string prefix \("" for none\); got undefined\.$/,
  },
  {
    name: "a null prefix",
    defaultLocale: "en",
    locales: withRu({ prefix: null, ogLocale: "ru_RU", hreflang: ["ru"] }),
    message: /^Locale "ru" needs a string prefix \("" for none\); got null\.$/,
  },
  {
    name: "a number prefix",
    defaultLocale: "en",
    locales: withRu({ prefix: 7, ogLocale: "ru_RU", hreflang: ["ru"] }),
    message: /^Locale "ru" needs a string prefix \("" for none\); got 7\.$/,
  },
  {
    name: "a missing hreflang",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU" }),
    message: /^Locale "ru" needs hreflang as an array of strings; got undefined\.$/,
  },
  {
    name: "a string hreflang",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: "ru" }),
    message: /^Locale "ru" needs hreflang as an array of strings; got "ru"\.$/,
  },
  {
    name: "a hreflang with a code that is not a string",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: ["ru", 1] }),
    message: /^Locale "ru" needs hreflang as an array of strings; got \["ru",1\]\.$/,
  },
  {
    name: "an empty hreflang",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: [] }),
    message: /^Locale "ru" has an empty hreflang\.$/,
  },
  {
    name: "a blank hreflang code",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: ["ru", " "] }),
    message: /^Locale "ru" has an empty hreflang\.$/,
  },
  {
    name: "one hreflang code on two locales",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: ["ru", "zh"] }),
    message: /^hreflang "zh" is on both "zh-CN" and "ru"\.$/,
  },
  {
    name: "one hreflang code on two locales in another case",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: ["ZH-cn"] }),
    message: /^hreflang "ZH-cn" is on both "zh-CN" and "ru"\.$/,
  },
  {
    name: "a missing ogLocale",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", hreflang: ["ru"] }),
    message: /^Locale "ru" needs a non-blank ogLocale; got undefined\.$/,
  },
  {
    name: "a blank ogLocale",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", hreflang: ["ru"], ogLocale: " " }),
    message: /^Locale "ru" needs a non-blank ogLocale; got " "\.$/,
  },
  {
    name: "an ogLocale that is not a string",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", hreflang: ["ru"], ogLocale: 1 }),
    message: /^Locale "ru" needs a non-blank ogLocale; got 1\.$/,
  },
];

export const VALID_LOCALE_CONFIGS: LocaleConfigCase[] = [
  { name: "Mosbuild", defaultLocale: "en", locales: MOSBUILD },
  { name: "Mosbuild with zh-CN disabled", defaultLocale: "en", locales: { en, "zh-CN": { ...zhCN, enabled: false } } },
  {
    name: "a prefixed default",
    defaultLocale: "en",
    locales: {
      en: { prefix: "en", ogLocale: "en_US", hreflang: ["en"] },
      ar: { prefix: "ar", ogLocale: "ar_SA", hreflang: ["ar"] },
    },
  },
  {
    name: "a prefixed default beside an unprefixed locale",
    defaultLocale: "en",
    locales: {
      en: { prefix: "en", ogLocale: "en_US", hreflang: ["en"] },
      ru: { prefix: "", ogLocale: "ru_RU", hreflang: ["ru"] },
    },
  },
  {
    name: "three locales",
    defaultLocale: "en",
    locales: withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: ["ru"] }),
  },
];

import { describe, expect, it } from "vitest";
import { INVALID_LOCALE_CONFIGS, type LocaleConfigCase, VALID_LOCALE_CONFIGS } from "../../test-fixtures/localeConfigCases.js";
import {
  defineDictionaries,
  defineLocales,
  enabledLocales,
  htmlLangOf,
  isLocaleEnabled,
  localeFromPath,
  type LocalesConfig,
  localizeHref,
  localizePath,
  otherLocales,
  stripLocalePrefix,
  withLocale,
} from "./index.js";

type Mosbuild = "en" | "zh-CN";

const MOSBUILD: LocalesConfig<Mosbuild> = {
  defaultLocale: "en",
  locales: {
    en: { prefix: "", ogLocale: "en_US", hreflang: ["en"], htmlLang: "en", label: "EN" },
    "zh-CN": { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN", "zh"], htmlLang: "zh-CN", label: "中文", enabled: true },
  },
};

const ZH_OFF: LocalesConfig<Mosbuild> = {
  ...MOSBUILD,
  locales: { ...MOSBUILD.locales, "zh-CN": { ...MOSBUILD.locales["zh-CN"], enabled: false } },
};

const RED_SEA: LocalesConfig<"en" | "ar"> = {
  defaultLocale: "en",
  locales: {
    en: { prefix: "en", ogLocale: "en_US", hreflang: ["en"] },
    ar: { prefix: "ar", ogLocale: "ar_SA", hreflang: ["ar"], htmlLang: "ar" },
  },
};

const PREFIXED_DEFAULT_PLUS_UNPREFIXED: LocalesConfig<"en" | "ru"> = {
  defaultLocale: "en",
  locales: {
    en: { prefix: "en", ogLocale: "en_US", hreflang: ["en"] },
    ru: { prefix: "", ogLocale: "ru_RU", hreflang: ["ru"] },
  },
};

const unknown = (locale: string) => locale as never;

describe("isLocaleEnabled", () => {
  it("defaults to true and reads enabled", () => {
    expect(isLocaleEnabled(MOSBUILD, "en")).toBe(true);
    expect(isLocaleEnabled(MOSBUILD, "zh-CN")).toBe(true);
    expect(isLocaleEnabled(ZH_OFF, "zh-CN")).toBe(false);
    expect(isLocaleEnabled(RED_SEA, "ar")).toBe(true);
  });

  it("is false for an unconfigured locale", () => {
    expect(isLocaleEnabled(MOSBUILD, unknown("zh-cn"))).toBe(false);
    expect(isLocaleEnabled(MOSBUILD, unknown("toString"))).toBe(false);
  });
});

describe("enabledLocales and otherLocales", () => {
  const THREE: LocalesConfig<"en" | "zh-CN" | "ru"> = {
    defaultLocale: "en",
    locales: {
      ru: { prefix: "ru", ogLocale: "ru_RU", hreflang: ["ru"] },
      en: { prefix: "", ogLocale: "en_US", hreflang: ["en"] },
      "zh-CN": { prefix: "cn", ogLocale: "zh_CN", hreflang: ["zh-CN"] },
    },
  };

  it("lists enabled locales in config order", () => {
    expect(enabledLocales(MOSBUILD)).toEqual(["en", "zh-CN"]);
    expect(enabledLocales(ZH_OFF)).toEqual(["en"]);
    expect(enabledLocales(RED_SEA)).toEqual(["en", "ar"]);
    expect(enabledLocales(THREE)).toEqual(["ru", "en", "zh-CN"]);
  });

  it("lists the other enabled locales", () => {
    expect(otherLocales(MOSBUILD, "en")).toEqual(["zh-CN"]);
    expect(otherLocales(MOSBUILD, "zh-CN")).toEqual(["en"]);
    expect(otherLocales(ZH_OFF, "en")).toEqual([]);
    expect(otherLocales(ZH_OFF, "zh-CN")).toEqual(["en"]);
    expect(otherLocales(RED_SEA, "ar")).toEqual(["en"]);
    expect(otherLocales(THREE, "en")).toEqual(["ru", "zh-CN"]);
  });
});

describe("localizePath", () => {
  it.each(["/", "/articles/", "/sectors/", "/articles/some-slug", "/media-gallery/some-slug", "/sectors/some-slug", "/partner/some-slug"])(
    "matches the pilot for %s",
    (path) => {
      const pilot = (locale: Mosbuild) => (locale === "en" ? path : `/cn${path}`);
      expect(localizePath(MOSBUILD, path, "en")).toBe(pilot("en"));
      expect(localizePath(MOSBUILD, path, "zh-CN")).toBe(pilot("zh-CN"));
    },
  );

  it("returns the path unchanged on an unprefixed locale", () => {
    for (const path of ["/about/", "about", "", "https://x.test/a", "/cn/about/"]) {
      expect(localizePath(MOSBUILD, path, "en")).toBe(path);
    }
  });

  it.each(["https://mosbuildexpo.com/about/", "http://x.test", "mailto:info@ite.group", "tel:+74951234567", "//cdn.test/x.pdf", "///about", "#speakers", "?page=2"])(
    "leaves %s alone",
    (path) => {
      expect(localizePath(MOSBUILD, path, "zh-CN")).toBe(path);
    },
  );

  it.each(["/cn/about/", "/cn", "/cn/", "cn/about", "/cn?x=1", "/cn#top"])("is idempotent — %s", (path) => {
    expect(localizePath(MOSBUILD, path, "zh-CN")).toBe(path);
  });

  it.each([
    ["about", "/cn/about"],
    ["/about/", "/cn/about/"],
    ["", "/cn/"],
    ["/", "/cn/"],
    ["/cnc-machines/", "/cn/cnc-machines/"],
    ["/about/?q=1#top", "/cn/about/?q=1#top"],
  ])("prefixes %j as %j", (path, expected) => {
    expect(localizePath(MOSBUILD, path, "zh-CN")).toBe(expected);
    expect(localizePath(MOSBUILD, expected, "zh-CN")).toBe(expected);
  });

  it("prefixes a prefixed default and a disabled locale", () => {
    expect(localizePath(RED_SEA, "/dining/", "en")).toBe("/en/dining/");
    expect(localizePath(RED_SEA, "/", "ar")).toBe("/ar/");
    expect(localizePath(ZH_OFF, "/about/", "zh-CN")).toBe("/cn/about/");
  });

  it("returns the path unchanged for an unconfigured locale", () => {
    expect(localizePath(MOSBUILD, "/about/", unknown("fr"))).toBe("/about/");
  });
});

describe("localizeHref", () => {
  const exclude = ["/lp/components"];

  it("returns the same string on an unprefixed locale", () => {
    for (const href of ["/", "", "/about/", "about", "/about/?x=1#y", "/brochure.pdf", "/lp/components/", "/cn/about/", "https://x.test/a", "#top", "?page=2"]) {
      expect(localizeHref(MOSBUILD, href, "en")).toBe(href);
      expect(localizeHref(MOSBUILD, href, "en", { exclude })).toBe(href);
    }
  });

  it.each([
    ["/", "/cn/"],
    ["", "/cn/"],
    ["about", "/cn/about"],
    ["/about/", "/cn/about/"],
    ["/about/?x=1#y", "/cn/about/?x=1#y"],
    ["/?x", "/cn/?x"],
    ["/cnc-machines/", "/cn/cnc-machines/"],
    ["/articles/web-2.0-trends/", "/cn/articles/web-2.0-trends/"],
    ["/sectors/node.js/", "/cn/sectors/node.js/"],
    ["/lp/components-2/", "/cn/lp/components-2/"],
    ["/brochure.pdf/", "/cn/brochure.pdf/"],
  ])("prefixes %j as %j", (href, expected) => {
    expect(localizeHref(MOSBUILD, href, "zh-CN")).toBe(expected);
    expect(localizeHref(MOSBUILD, expected, "zh-CN")).toBe(expected);
  });

  it.each(["https://expopharmtech.com/about/", "http://x.test", "mailto:info@ite.group", "tel:+74951234567", "//cdn.test/x", "///about", "#speakers", "?page=2"])(
    "leaves %s alone",
    (href) => {
      expect(localizeHref(MOSBUILD, href, "zh-CN")).toBe(href);
    },
  );

  it.each(["/cn", "/cn/", "/cn/about/", "/cn?x=1", "/cn#top", "cn/about", "/cn/brochure.pdf", "/cn/lp/components/"])(
    "is idempotent — %s",
    (href) => {
      expect(localizeHref(MOSBUILD, href, "zh-CN")).toBe(href);
    },
  );

  it.each([
    "/brochure.pdf", "/uploads/a.PDF?v=2", "/Brochure.PDF#page=2", "uploads/a.pdf", "/sitemap.xml", "/robots.txt",
    "/data.json", "/export.csv", "/archive.zip", "/archive.rar", "/feed.rss", "/doc.doc", "/doc.docx", "/sheet.xls",
    "/sheet.xlsx", "/deck.ppt", "/deck.pptx", "/event.ics", "/img.jpg", "/img.jpeg", "/img.png", "/img.gif",
    "/logo.svg", "/img.webp", "/img.avif", "/favicon.ico", "/clip.mp4", "/clip.webm", "/audio.mp3",
  ])("leaves the static file %s alone", (href) => {
    expect(localizeHref(MOSBUILD, href, "zh-CN")).toBe(href);
  });

  it.each(["/lp/components", "/lp/components/", "/lp/components/x/", "/lp/components?x=1", "/lp/components#y", "lp/components"])(
    "leaves the excluded %s alone",
    (href) => {
      expect(localizeHref(MOSBUILD, href, "zh-CN", { exclude })).toBe(href);
    },
  );

  it.each(["/lp/", "/lp/components-x/", "/lpx/components/", "/x/lp/components/", "/LP/components/"])(
    "prefixes %s, which is not excluded",
    (href) => {
      expect(localizeHref(MOSBUILD, href, "zh-CN", { exclude })).toBe(`/cn${href}`);
    },
  );

  it("accepts entries with or without slashes", () => {
    for (const entries of [["lp/components/"], ["/lp/components/"], ["/lp/components?x"]]) {
      expect(localizeHref(MOSBUILD, "/lp/components/x/", "zh-CN", { exclude: entries })).toBe("/lp/components/x/");
    }
  });

  it("ignores an entry with no segments", () => {
    expect(localizeHref(MOSBUILD, "/about/", "zh-CN", { exclude: ["", "/", "?x"] })).toBe("/cn/about/");
  });

  it("matches any of several entries", () => {
    const entries = ["/lp/components", "/en-only"];
    expect(localizeHref(MOSBUILD, "/en-only/x/", "zh-CN", { exclude: entries })).toBe("/en-only/x/");
    expect(localizeHref(MOSBUILD, "/about/", "zh-CN", { exclude: entries })).toBe("/cn/about/");
  });

  it("prefixes a prefixed default and a disabled locale", () => {
    expect(localizeHref(RED_SEA, "/dining/", "en")).toBe("/en/dining/");
    expect(localizeHref(RED_SEA, "/", "ar")).toBe("/ar/");
    expect(localizeHref(ZH_OFF, "/about/", "zh-CN")).toBe("/cn/about/");
  });

  it("returns the href unchanged for an unconfigured locale", () => {
    expect(localizeHref(MOSBUILD, "/about/", unknown("fr"))).toBe("/about/");
  });
});

describe("stripLocalePrefix", () => {
  it("drops one leading prefix segment", () => {
    expect(stripLocalePrefix(MOSBUILD, ["cn", "about"], "zh-CN")).toEqual(["about"]);
    expect(stripLocalePrefix(MOSBUILD, ["cn", "cn", "x"], "zh-CN")).toEqual(["cn", "x"]);
    expect(stripLocalePrefix(MOSBUILD, ["cn"], "zh-CN")).toEqual([]);
    expect(stripLocalePrefix(RED_SEA, ["en", "dining"], "en")).toEqual(["dining"]);
  });

  it("returns the same segments when there is nothing to strip", () => {
    const segments = ["cn", "about"];
    expect(stripLocalePrefix(MOSBUILD, segments, "en")).toBe(segments);
    const plain = ["about"];
    expect(stripLocalePrefix(MOSBUILD, plain, "zh-CN")).toBe(plain);
    expect(stripLocalePrefix(MOSBUILD, [], "zh-CN")).toEqual([]);
    expect(stripLocalePrefix(MOSBUILD, ["cnc-machines"], "zh-CN")).toEqual(["cnc-machines"]);
  });
});

describe("localeFromPath", () => {
  it.each([
    ["/cn/about/", "zh-CN"],
    ["/cn", "zh-CN"],
    ["/cn/", "zh-CN"],
    ["/about/", "en"],
    ["/", "en"],
    ["", "en"],
    ["/cnc-machines/", "en"],
    ["/CN/about/", "en"],
  ])("Mosbuild %j → %s", (path, locale) => {
    expect(localeFromPath(MOSBUILD, path)).toBe(locale);
  });

  it("ignores a disabled locale", () => {
    expect(localeFromPath(ZH_OFF, "/cn/about/")).toBe("en");
  });

  it("falls back to the default when every locale is prefixed", () => {
    expect(localeFromPath(RED_SEA, "/ar/dining/")).toBe("ar");
    expect(localeFromPath(RED_SEA, "/en/dining/")).toBe("en");
    expect(localeFromPath(RED_SEA, "/dining/")).toBe("en");
    expect(localeFromPath(RED_SEA, "/")).toBe("en");
  });

  it("prefers the enabled unprefixed locale over a prefixed default", () => {
    const config = PREFIXED_DEFAULT_PLUS_UNPREFIXED;
    expect(localeFromPath(config, "/en/about/")).toBe("en");
    expect(localeFromPath(config, "/about/")).toBe("ru");
    expect(localeFromPath(config, "/")).toBe("ru");
    const ruOff = { ...config, locales: { ...config.locales, ru: { ...config.locales.ru, enabled: false } } };
    expect(localeFromPath(ruOff, "/about/")).toBe("en");
  });
});

describe("htmlLangOf", () => {
  it("reads htmlLang and falls back to the locale key", () => {
    expect(htmlLangOf(MOSBUILD, "zh-CN")).toBe("zh-CN");
    expect(htmlLangOf(RED_SEA, "ar")).toBe("ar");
    expect(htmlLangOf(RED_SEA, "en")).toBe("en");
    expect(htmlLangOf({ ...MOSBUILD, locales: { ...MOSBUILD.locales, "zh-CN": { ...MOSBUILD.locales["zh-CN"], htmlLang: "zh-Hans" } } }, "zh-CN")).toBe("zh-Hans");
    expect(htmlLangOf({ ...MOSBUILD, locales: { ...MOSBUILD.locales, en: { ...MOSBUILD.locales.en, htmlLang: "" } } }, "en")).toBe("en");
    expect(htmlLangOf(MOSBUILD, unknown("fr"))).toBe("fr");
  });
});

describe("withLocale", () => {
  const variables = { slug: "a", pageSize: 10 };

  it("adds nothing for the default locale", () => {
    expect(withLocale(MOSBUILD, variables, "en")).toBe(variables);
    expect(withLocale(MOSBUILD, variables)).toBe(variables);
    expect(withLocale(MOSBUILD, undefined, "en")).toBeUndefined();
    expect(withLocale(RED_SEA, variables, "en")).toBe(variables);
    const request = (vars: unknown) => JSON.stringify({ query: "query Page($slug: String)", variables: vars });
    expect(request(withLocale(MOSBUILD, variables, "en"))).toBe(request(variables));
  });

  it("adds locale for any other locale without touching the input", () => {
    expect(withLocale(MOSBUILD, variables, "zh-CN")).toEqual({ slug: "a", pageSize: 10, locale: "zh-CN" });
    expect(variables).toEqual({ slug: "a", pageSize: 10 });
    expect(withLocale(MOSBUILD, undefined, "zh-CN")).toEqual({ locale: "zh-CN" });
    expect(withLocale(RED_SEA, variables, "ar")).toEqual({ slug: "a", pageSize: 10, locale: "ar" });
  });
});

describe("defineLocales", () => {
  it("returns the config with every function bound to it", () => {
    const locales = defineLocales(MOSBUILD);
    expect(locales.defaultLocale).toBe("en");
    expect(locales.locales).toBe(MOSBUILD.locales);
    expect(locales.isLocaleEnabled("zh-CN")).toBe(true);
    expect(locales.enabledLocales()).toEqual(["en", "zh-CN"]);
    expect(locales.otherLocales("en")).toEqual(["zh-CN"]);
    expect(locales.localizePath("/about/", "zh-CN")).toBe("/cn/about/");
    expect(locales.localizeHref("/about/", "zh-CN")).toBe("/cn/about/");
    expect(locales.localizeHref("/brochure.pdf", "zh-CN")).toBe("/brochure.pdf");
    expect(locales.localizeHref("/lp/components/x/", "zh-CN", { exclude: ["/lp/components"] })).toBe("/lp/components/x/");
    expect(locales.stripLocalePrefix(["cn", "about"], "zh-CN")).toEqual(["about"]);
    expect(locales.localeFromPath("/cn/x/")).toBe("zh-CN");
    expect(locales.htmlLangOf("zh-CN")).toBe("zh-CN");
    expect(locales.withLocale({ slug: "a" }, "zh-CN")).toEqual({ slug: "a", locale: "zh-CN" });
    expect(localizePath(locales, "/x/", "zh-CN")).toBe("/cn/x/");
  });

  const en = MOSBUILD.locales.en;
  const withRu = (ru: Record<string, unknown>) =>
    ({ ...MOSBUILD, locales: { ...MOSBUILD.locales, ru } }) as unknown as LocalesConfig;

  it.each<[string, LocalesConfig, string]>([
    ["defaultLocale missing", { ...MOSBUILD, defaultLocale: "zh-cn" }, '[i18n] defaultLocale "zh-cn" is not one of the configured locales (en, zh-CN).'],
    ["duplicate prefix", withRu({ ...en, prefix: "cn", hreflang: ["ru"] }), '[i18n] Locales "zh-CN" and "ru" both use the prefix "cn".'],
    ["two empty prefixes", withRu({ ...en, hreflang: ["ru"] }), '[i18n] Locales "en" and "ru" are both unprefixed; only one locale may have prefix "".'],
    ["a prefix with a slash", withRu({ ...en, prefix: "ru/msk", hreflang: ["ru"] }), '[i18n] Locale "ru" has prefix "ru/msk"; a prefix is one path segment, without "/".'],
    ["an empty hreflang", withRu({ ...en, prefix: "ru", hreflang: [] }), '[i18n] Locale "ru" has an empty hreflang.'],
    ["a blank hreflang code", withRu({ ...en, prefix: "ru", hreflang: [" "] }), '[i18n] Locale "ru" has an empty hreflang.'],
    ["one hreflang on two locales", withRu({ ...en, prefix: "ru", hreflang: ["ZH"] }), '[i18n] hreflang "ZH" is on both "zh-CN" and "ru".'],
    ["a prefix that is not a string", withRu({ ogLocale: "ru_RU", hreflang: ["ru"] }), '[i18n] Locale "ru" needs a string prefix ("" for none); got undefined.'],
    ["hreflang that is not an array of strings", withRu({ prefix: "ru", ogLocale: "ru_RU", hreflang: "ru" }), '[i18n] Locale "ru" needs hreflang as an array of strings; got "ru".'],
    ["an ogLocale that is not a non-blank string", withRu({ prefix: "ru", hreflang: ["ru"], ogLocale: " " }), '[i18n] Locale "ru" needs a non-blank ogLocale; got " ".'],
  ])("throws on %s", (_, config, message) => {
    expect(() => defineLocales(config)).toThrow(message);
  });

  it("accepts Mosbuild, a prefixed default, and a prefixed default beside an unprefixed locale", () => {
    expect(() => defineLocales(MOSBUILD)).not.toThrow();
    expect(() => defineLocales(ZH_OFF)).not.toThrow();
    expect(() => defineLocales(RED_SEA)).not.toThrow();
    expect(() => defineLocales(PREFIXED_DEFAULT_PLUS_UNPREFIXED)).not.toThrow();
  });
});

describe("defineDictionaries", () => {
  it("returns each locale's dictionary", () => {
    const en = { nav: { menu: "Menu" } };
    const zh = { nav: { menu: "菜单" } };
    const getDictionary = defineDictionaries({ en, "zh-CN": zh });
    expect(getDictionary("en")).toBe(en);
    expect(getDictionary("zh-CN")).toBe(zh);
  });
});

describe("the shared locale config cases", () => {
  const define = ({ defaultLocale, locales }: LocaleConfigCase) => () =>
    defineLocales({ defaultLocale, locales } as unknown as LocalesConfig);

  const thrownMessage = (run: () => unknown): string => {
    try {
      run();
    } catch (error) {
      return (error as Error).message;
    }
    return "nothing was thrown";
  };

  it.each(INVALID_LOCALE_CONFIGS)("throws on $name", (entry) => {
    const message = thrownMessage(define(entry));
    expect(message).toMatch(/^\[i18n\] /);
    expect(message.slice("[i18n] ".length)).toMatch(entry.message);
  });

  it.each(VALID_LOCALE_CONFIGS)("accepts $name", (entry) => {
    expect(define(entry)).not.toThrow();
  });
});

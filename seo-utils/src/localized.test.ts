import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INVALID_LOCALE_CONFIGS, type LocaleConfigCase, VALID_LOCALE_CONFIGS } from "../../test-fixtures/localeConfigCases.js";
import {
  alternatesFromLocalizations,
  createLocalizedSeo,
  type LocalizedSeoConfig,
} from "./localized.js";
import { createSeo } from "./seo.js";

const SITE = {
  siteUrl: "https://mosbuildexpo.com",
  siteName: "MosBuild",
  canonicalPolicy: "strict-same-origin",
  noIndexPolicy: "strict",
} as const;

const LOCALES = {
  defaultLocale: "en",
  locales: {
    en: { prefix: "", ogLocale: "en_US", hreflang: ["en"], htmlLang: "en", label: "EN" },
    "zh-CN": {
      prefix: "cn",
      ogLocale: "zh_CN",
      hreflang: ["zh-CN", "zh"],
      htmlLang: "zh-CN",
      label: "中文",
      enabled: true,
    },
  },
};

const MOSBUILD: LocalizedSeoConfig = { ...SITE, ...LOCALES };

const ZH_OFF: LocalizedSeoConfig = {
  ...MOSBUILD,
  locales: { ...LOCALES.locales, "zh-CN": { ...LOCALES.locales["zh-CN"], enabled: false } },
};

const THREE: LocalizedSeoConfig = {
  ...MOSBUILD,
  locales: {
    ...LOCALES.locales,
    ru: { prefix: "ru", ogLocale: "ru_RU", hreflang: ["ru"] },
  },
};

const RED_SEA: LocalizedSeoConfig = {
  siteUrl: "https://www.shebara.sa/",
  siteName: "Shebara",
  canonicalPolicy: "strict-same-origin",
  defaultLocale: "en",
  locales: {
    en: { prefix: "en", ogLocale: "en_US", hreflang: ["en"] },
    ar: { prefix: "ar", ogLocale: "ar_SA", hreflang: ["ar"] },
  },
};

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    logged.push(a.join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

describe("the default locale is the main entry", () => {
  const POLICIES = [
    {},
    { canonicalPolicy: "strict-same-origin", noIndexPolicy: "strict" },
  ] as const;
  const SEO_CASES: Array<Record<string, unknown> | null | undefined> = [
    undefined,
    null,
    {},
    { metaTitle: "Visit", metaDescription: "Come to MosBuild.", keywords: "a, b" },
    { metaTitle: " ", metaDescription: " ", keywords: ["a", "b"] },
    { noIndex: true },
    { noIndex: "false" },
    { metaRobots: "noindex, follow" },
    { canonicalURL: "https://mosbuildexpo.com/other/" },
    { canonicalURL: "https://mosbuildexpo.com/cnc-machines/" },
    { canonicalURL: "https://mosbuildexpo.com/" },
    { canonicalURL: "https://mosbuildexpo.com" },
    { canonicalURL: "https://mosbuildexpo.com/?utm_source=x" },
    { canonicalURL: "https://mosbuildexpo.com?utm_source=x" },
    { canonicalURL: "https://mosbuildexpo.com/#top" },
    { canonicalURL: "http://mosbuildexpo.com/about/" },
    { canonicalURL: "https://elsewhere.test/x/" },
    { canonicalURL: "seoteam@acronym.com" },
    { canonicalURL: "/about" },
    { canonicalURL: "  " },
    { metaImage: { url: "/uploads/hall.jpg" } },
    { metaImage: { url: "https://cdn.test/hall.jpg" } },
  ];
  const ROUTES = [undefined, null, "", "/", "about", "/about/", " articles/x ", "cnc-machines", "cn/about"];
  const PAGES = [
    undefined,
    null,
    { Title: "Exhibit" },
    { Header: { Title: "Industry Insights // Hub", Content: "<p>Intro.</p>" } },
    { Name: "Anna Petrova", Title: "CEO", Company: "Acme" },
    { PageName: "pre-reg", Excerpt: "Short." },
  ];

  it.each(POLICIES)("serialises and logs exactly like createSeo — %o", (policy) => {
    const base = { siteUrl: SITE.siteUrl, siteName: SITE.siteName, ...policy };
    const main = createSeo({ ...base, locale: "en_US" }).generateSEOMetadata;
    const en = createLocalizedSeo({ ...base, ...LOCALES }).forLocale("en").generateSEOMetadata;
    let compared = 0;
    for (const seo of SEO_CASES) {
      for (const route of ROUTES) {
        for (const page of PAGES) {
          const expected = JSON.stringify(main(seo, route, page));
          const expectedLogs = logged.splice(0);
          expect(JSON.stringify(en(seo, route, page))).toBe(expected);
          expect(logged.splice(0)).toEqual(expectedLogs);
          compared++;
        }
      }
    }
    expect(compared).toBe(SEO_CASES.length * ROUTES.length * PAGES.length);
  });

  it.each(POLICIES)("leaves the site root on a sub-page to createSeo — %o", (policy) => {
    const base = { siteUrl: SITE.siteUrl, siteName: SITE.siteName, ...policy };
    const en = createLocalizedSeo({ ...base, ...LOCALES }).forLocale("en").generateSEOMetadata;
    const root = en({ canonicalURL: "https://mosbuildexpo.com/" }, "about").alternates.canonical;
    const withQuery = en({ canonicalURL: "https://mosbuildexpo.com/?utm_source=x" }, "about").alternates.canonical;
    expect(root).toBe("https://mosbuildexpo.com/about/");
    expect(withQuery).toBe("https://mosbuildexpo.com/?utm_source=x");
    expect(logged.some((l) => l.includes("locale home"))).toBe(false);
  });

  it("adds nothing but alternates.languages when there is a counterpart", () => {
    const main = createSeo({ ...SITE, locale: "en_US" }).generateSEOMetadata(null, "about");
    const md = createLocalizedSeo(MOSBUILD)
      .forLocale("en")
      .generateSEOMetadata(null, "about", undefined, { alternates: { "zh-CN": "about" } });
    expect(JSON.stringify(md)).toBe(
      JSON.stringify({
        ...main,
        alternates: {
          ...main.alternates,
          languages: {
            en: "https://mosbuildexpo.com/about/",
            "zh-CN": "https://mosbuildexpo.com/cn/about/",
            zh: "https://mosbuildexpo.com/cn/about/",
            "x-default": "https://mosbuildexpo.com/about/",
          },
        },
      }),
    );
  });
});

describe("Mosbuild, pinned from the pilot's exported HTML", () => {
  const seo = createLocalizedSeo(MOSBUILD);
  const LANGUAGES = [
    ["en", "https://mosbuildexpo.com/"],
    ["zh-CN", "https://mosbuildexpo.com/cn/"],
    ["zh", "https://mosbuildexpo.com/cn/"],
    ["x-default", "https://mosbuildexpo.com/"],
  ];

  it("zh home", () => {
    const md = seo.forLocale("zh-CN").generateSEOMetadata(null, "", undefined, { alternates: { en: "" } });
    expect(md.alternates.canonical).toBe("https://mosbuildexpo.com/cn/");
    expect(Object.entries(md.alternates.languages ?? {})).toEqual(LANGUAGES);
    expect(md.openGraph.locale).toBe("zh_CN");
    expect(md.openGraph.url).toBe("https://mosbuildexpo.com/cn/");
    expect(md.openGraph).not.toHaveProperty("alternateLocale");
  });

  it("en home", () => {
    const md = seo.forLocale("en").generateSEOMetadata(null, "", undefined, { alternates: { "zh-CN": "" } });
    expect(md.alternates.canonical).toBe("https://mosbuildexpo.com/");
    expect(Object.entries(md.alternates.languages ?? {})).toEqual(LANGUAGES);
    expect(md.openGraph.locale).toBe("en_US");
  });
});

describe("hreflang", () => {
  const seo = createLocalizedSeo(MOSBUILD);

  it("pairs different slugs per locale", () => {
    const zh = seo.forLocale("zh-CN").generateSEOMetadata(null, "articles/b", undefined, {
      alternates: { en: "articles/a" },
    });
    expect(zh.alternates).toEqual({
      canonical: "https://mosbuildexpo.com/cn/articles/b/",
      languages: {
        en: "https://mosbuildexpo.com/articles/a/",
        "zh-CN": "https://mosbuildexpo.com/cn/articles/b/",
        zh: "https://mosbuildexpo.com/cn/articles/b/",
        "x-default": "https://mosbuildexpo.com/articles/a/",
      },
    });
    const en = seo.forLocale("en").generateSEOMetadata(null, "articles/a", undefined, {
      alternates: { "zh-CN": "/cn/articles/b/" },
    });
    expect(en.alternates.languages).toEqual(zh.alternates.languages);
  });

  it.each([
    ["no options", undefined],
    ["no alternates", {}],
    ["empty alternates", { alternates: {} }],
    ["null counterpart", { alternates: { "zh-CN": null } }],
    ["undefined counterpart", { alternates: { "zh-CN": undefined } }],
    ["only its own locale", { alternates: { en: "about" } }],
    ["an unconfigured locale", { alternates: { fr: "about" } }],
  ])("emits no languages key without a counterpart — %s", (_, options) => {
    const md = seo.forLocale("en").generateSEOMetadata({ metaTitle: "A" }, "about", undefined, options);
    expect("languages" in md.alternates).toBe(false);
    expect(JSON.stringify(md)).toBe(
      JSON.stringify(createSeo({ ...SITE, locale: "en_US" }).generateSEOMetadata({ metaTitle: "A" }, "about")),
    );
  });

  it("emits none on either locale while zh is disabled, and keeps zh under /cn/", () => {
    const off = createLocalizedSeo(ZH_OFF);
    const en = off.forLocale("en").generateSEOMetadata(null, "about", undefined, { alternates: { "zh-CN": "about" } });
    const zhHome = off.forLocale("zh-CN").generateSEOMetadata(null, "", undefined, { alternates: { en: "" } });
    const zhPage = off.forLocale("zh-CN").generateSEOMetadata(null, "about", undefined, { alternates: { en: "about" } });
    expect("languages" in en.alternates).toBe(false);
    expect("languages" in zhHome.alternates).toBe(false);
    expect("languages" in zhPage.alternates).toBe(false);
    expect(zhHome.alternates.canonical).toBe("https://mosbuildexpo.com/cn/");
    expect(zhPage.alternates.canonical).toBe("https://mosbuildexpo.com/cn/about/");
    expect(zhPage.openGraph.locale).toBe("zh_CN");
  });

  it("leaves x-default out when the default locale is not in the set", () => {
    const md = createLocalizedSeo(THREE)
      .forLocale("zh-CN")
      .generateSEOMetadata(null, "about", undefined, { alternates: { ru: "o-nas" } });
    expect(Object.entries(md.alternates.languages ?? {})).toEqual([
      ["zh-CN", "https://mosbuildexpo.com/cn/about/"],
      ["zh", "https://mosbuildexpo.com/cn/about/"],
      ["ru", "https://mosbuildexpo.com/ru/o-nas/"],
    ]);
  });

  it("orders three locales by config, codes in order, x-default last", () => {
    const md = createLocalizedSeo(THREE)
      .forLocale("ru")
      .generateSEOMetadata(null, "o-nas", undefined, { alternates: { "zh-CN": "about", en: "about" } });
    expect(Object.entries(md.alternates.languages ?? {})).toEqual([
      ["en", "https://mosbuildexpo.com/about/"],
      ["zh-CN", "https://mosbuildexpo.com/cn/about/"],
      ["zh", "https://mosbuildexpo.com/cn/about/"],
      ["ru", "https://mosbuildexpo.com/ru/o-nas/"],
      ["x-default", "https://mosbuildexpo.com/about/"],
    ]);
    expect(md.alternates.canonical).toBe("https://mosbuildexpo.com/ru/o-nas/");
    expect(md.openGraph.locale).toBe("ru_RU");
  });

  it("skips a disabled counterpart but keeps the enabled ones", () => {
    const md = createLocalizedSeo({
      ...THREE,
      locales: { ...THREE.locales, ru: { ...THREE.locales.ru, enabled: false } },
    })
      .forLocale("en")
      .generateSEOMetadata(null, "about", undefined, { alternates: { "zh-CN": "about", ru: "o-nas" } });
    expect(Object.keys(md.alternates.languages ?? {})).toEqual(["en", "zh-CN", "zh", "x-default"]);
  });
});

describe("the pageData ladder on zh", () => {
  const zh = createLocalizedSeo(MOSBUILD).forLocale("zh-CN").generateSEOMetadata;
  const main = createSeo({ ...SITE, locale: "zh_CN" }).generateSEOMetadata;

  it("uses Header.Title", () => {
    const page = { Header: { Title: "行业洞察 // 中心", Content: "<p>简介。</p>" } };
    expect(zh(null, "insights", page).title.absolute).toBe("行业洞察 中心");
    expect(zh(null, "insights", page).description).toBe("简介。");
    expect(JSON.stringify(zh(null, "insights", page))).toBe(JSON.stringify(main(null, "cn/insights", page)));
  });

  it("puts Name before the job Title", () => {
    const page = { Name: "安娜", Title: "首席执行官", Company: "Acme" };
    expect(zh(null, "speakers/anna", page).title.absolute).toBe("安娜 — 首席执行官");
    expect(JSON.stringify(zh(null, "speakers/anna", page))).toBe(JSON.stringify(main(null, "cn/speakers/anna", page)));
  });
});

describe("canonical guard", () => {
  const seo = createLocalizedSeo(MOSBUILD);
  const en = seo.forLocale("en").generateSEOMetadata;
  const zh = seo.forLocale("zh-CN").generateSEOMetadata;

  it("rejects an English canonical on a zh page", () => {
    expect(zh({ canonicalURL: "https://mosbuildexpo.com/about/" }, "about").alternates.canonical).toBe(
      "https://mosbuildexpo.com/cn/about/",
    );
    expect(logged).toEqual([
      '[seo] Ignoring CMS canonicalURL "https://mosbuildexpo.com/about/" on /cn/about/; it belongs to locale "en".',
    ]);
  });

  it("rejects the site root on the zh home", () => {
    expect(zh({ canonicalURL: "https://mosbuildexpo.com/" }, "").alternates.canonical).toBe(
      "https://mosbuildexpo.com/cn/",
    );
    expect(logged).toEqual([
      '[seo] Ignoring CMS canonicalURL "https://mosbuildexpo.com/" on /cn/; it belongs to locale "en".',
    ]);
  });

  it("rejects a /cn/ canonical on an English page", () => {
    expect(en({ canonicalURL: "https://mosbuildexpo.com/cn/about/" }, "about").alternates.canonical).toBe(
      "https://mosbuildexpo.com/about/",
    );
    expect(logged).toEqual([
      '[seo] Ignoring CMS canonicalURL "https://mosbuildexpo.com/cn/about/" on /about/; it belongs to locale "zh-CN".',
    ]);
  });

  it("counts a disabled locale's prefix", () => {
    const off = createLocalizedSeo(ZH_OFF).forLocale("en").generateSEOMetadata;
    expect(off({ canonicalURL: "https://mosbuildexpo.com/cn/about/" }, "about").alternates.canonical).toBe(
      "https://mosbuildexpo.com/about/",
    );
    expect(logged).toHaveLength(1);
  });

  it.each(["https://mosbuildexpo.com/cn/", "https://mosbuildexpo.com/cn", "https://mosbuildexpo.com/cn/?utm=x"])(
    "rejects the zh home claimed by a zh sub-page — %s",
    (value) => {
      expect(zh({ canonicalURL: value }, "about").alternates.canonical).toBe("https://mosbuildexpo.com/cn/about/");
      expect(logged).toEqual([
        `[seo] Ignoring CMS canonicalURL ${JSON.stringify(value)} on /cn/about/; a sub-page must not declare its locale home as its canonical.`,
      ]);
    },
  );

  it("keeps /cn/ on the zh home", () => {
    expect(zh({ canonicalURL: "https://mosbuildexpo.com/cn/" }, "").alternates.canonical).toBe(
      "https://mosbuildexpo.com/cn/",
    );
    expect(zh({ canonicalURL: "https://mosbuildexpo.com/cn/" }, "/cn/").alternates.canonical).toBe(
      "https://mosbuildexpo.com/cn/",
    );
    expect(logged).toEqual([]);
  });

  it("keeps /cnc-machines/ on an English page — the whole segment must match", () => {
    expect(en({ canonicalURL: "https://mosbuildexpo.com/cnc-machines/" }, "machines").alternates.canonical).toBe(
      "https://mosbuildexpo.com/cnc-machines/",
    );
    expect(logged).toEqual([]);
  });

  it("keeps a valid /cn/x/ on a zh page", () => {
    expect(zh({ canonicalURL: "https://mosbuildexpo.com/cn/x/" }, "about").alternates.canonical).toBe(
      "https://mosbuildexpo.com/cn/x/",
    );
    expect(logged).toEqual([]);
  });

  it.each([
    [{}, "https://elsewhere.test/x/"],
    [{}, "seoteam@acronym.com"],
    [{}, "/cn/x/"],
    [{ canonicalPolicy: "strict-same-origin" }, "https://elsewhere.test/x/"],
    [{ canonicalPolicy: "strict-same-origin" }, "seoteam@acronym.com"],
    [{ canonicalPolicy: "strict-same-origin" }, "/cn/x/"],
  ] as const)("hands %o %s to createSeo untouched", (policy, value) => {
    const base = { siteUrl: SITE.siteUrl, siteName: SITE.siteName, ...policy };
    const seoData = { canonicalURL: value };
    const expected = JSON.stringify(createSeo({ ...base, locale: "zh_CN" }).generateSEOMetadata(seoData, "cn/about"));
    const mainLogs = logged.splice(0);
    const md = createLocalizedSeo({ ...base, ...LOCALES }).forLocale("zh-CN").generateSEOMetadata(seoData, "about");
    expect(JSON.stringify(md)).toBe(expected);
    expect(logged).toEqual(mainLogs);
    expect(logged.some((l) => l.includes("belongs to") || l.includes("locale home"))).toBe(false);
  });

  it("passes an accepted seoData by reference", () => {
    let copied = 0;
    const seoData = new Proxy(
      { canonicalURL: "https://mosbuildexpo.com/cn/x/", metaTitle: "X" },
      {
        ownKeys(target) {
          copied++;
          return Reflect.ownKeys(target);
        },
      },
    );
    zh(seoData, "about");
    expect(copied).toBe(0);
  });

  it("rejects on a copy and leaves the caller's object alone", () => {
    const seoData = { canonicalURL: "https://mosbuildexpo.com/about/", metaTitle: "X" };
    const md = zh(seoData, "about");
    expect(seoData.canonicalURL).toBe("https://mosbuildexpo.com/about/");
    expect(md.title.absolute).toBe("X");
  });

  it("logs once per rejection and never on accept", () => {
    zh({ canonicalURL: "https://mosbuildexpo.com/about/" }, "about");
    zh({ canonicalURL: "https://mosbuildexpo.com/cn/x/" }, "about");
    en({ canonicalURL: "https://mosbuildexpo.com/cn/" }, "");
    en({ canonicalURL: "https://mosbuildexpo.com/about/" }, "contact");
    expect(logged).toHaveLength(2);
  });
});

describe("route cleaning", () => {
  const seo = createLocalizedSeo(MOSBUILD);

  it.each(["cn/about", "/cn/about/", "about", " /about/ "])("zh %j", (route) => {
    expect(seo.forLocale("zh-CN").generateSEOMetadata(null, route).alternates.canonical).toBe(
      "https://mosbuildexpo.com/cn/about/",
    );
    expect(seo.localizedRoute(route, "zh-CN")).toBe("cn/about");
    expect(seo.localizedUrl(route, "zh-CN")).toBe("https://mosbuildexpo.com/cn/about/");
  });

  it("drops only one leading prefix segment", () => {
    expect(seo.localizedRoute("cn/cn/about", "zh-CN")).toBe("cn/cn/about");
    expect(seo.localizedRoute("cnc-machines", "zh-CN")).toBe("cn/cnc-machines");
    expect(seo.localizedRoute("cn", "zh-CN")).toBe("cn");
  });

  it("strips nothing on the unprefixed locale", () => {
    expect(seo.localizedRoute("cn/about", "en")).toBe("cn/about");
    expect(seo.localizedRoute("/about/", "en")).toBe("about");
    expect(seo.localizedUrl("", "en")).toBe("https://mosbuildexpo.com/");
    expect(seo.localizedUrl("/", "zh-CN")).toBe("https://mosbuildexpo.com/cn/");
  });

  it("cleans each alternate with its own locale", () => {
    const md = seo.forLocale("en").generateSEOMetadata(null, "cn-guide", undefined, {
      alternates: { "zh-CN": "/cn/guide/" },
    });
    expect(md.alternates.languages?.en).toBe("https://mosbuildexpo.com/cn-guide/");
    expect(md.alternates.languages?.["zh-CN"]).toBe("https://mosbuildexpo.com/cn/guide/");
  });
});

describe("config validation", () => {
  const en = LOCALES.locales.en;

  it.each<[string, LocalizedSeoConfig]>([
    ["defaultLocale missing", { ...MOSBUILD, defaultLocale: "zh-cn" }],
    ["duplicate prefix", { ...MOSBUILD, locales: { ...MOSBUILD.locales, ru: { ...en, prefix: "cn", hreflang: ["ru"] } } }],
    ["two empty prefixes", { ...MOSBUILD, locales: { ...MOSBUILD.locales, ru: { ...en, hreflang: ["ru"] } } }],
    ["a prefix with a slash", { ...MOSBUILD, locales: { ...MOSBUILD.locales, ru: { ...en, prefix: "ru/moscow", hreflang: ["ru"] } } }],
    ["an empty hreflang", { ...MOSBUILD, locales: { ...MOSBUILD.locales, ru: { ...en, prefix: "ru", hreflang: [] } } }],
    ["a blank hreflang code", { ...MOSBUILD, locales: { ...MOSBUILD.locales, ru: { ...en, prefix: "ru", hreflang: [" "] } } }],
    ["one hreflang on two locales", { ...MOSBUILD, locales: { ...MOSBUILD.locales, ru: { ...en, prefix: "ru", hreflang: ["ru", "zh"] } } }],
    ["one hreflang on two locales, any case", { ...MOSBUILD, locales: { ...MOSBUILD.locales, ru: { ...en, prefix: "ru", hreflang: ["ZH-cn"] } } }],
  ])("throws on %s", (_, config) => {
    expect(() => createLocalizedSeo(config)).toThrow(/^\[seo\] /);
  });

  const shaped = (ru: Record<string, unknown>) =>
    ({ ...MOSBUILD, locales: { ...MOSBUILD.locales, ru } }) as unknown as LocalizedSeoConfig;

  it.each([
    [{ ogLocale: "ru_RU", hreflang: ["ru"] }, 'needs a string prefix ("" for none); got undefined.'],
    [{ prefix: null, ogLocale: "ru_RU", hreflang: ["ru"] }, 'needs a string prefix ("" for none); got null.'],
    [{ prefix: 7, ogLocale: "ru_RU", hreflang: ["ru"] }, 'needs a string prefix ("" for none); got 7.'],
  ])("throws on a prefix that is not a string — %o", (ru, message) => {
    expect(() => createLocalizedSeo(shaped(ru))).toThrow(`[seo] Locale "ru" ${message}`);
  });

  it.each([
    [{ prefix: "ru", ogLocale: "ru_RU" }, "got undefined."],
    [{ prefix: "ru", ogLocale: "ru_RU", hreflang: "ru" }, 'got "ru".'],
    [{ prefix: "ru", ogLocale: "ru_RU", hreflang: ["ru", 1] }, 'got ["ru",1].'],
  ])("throws on hreflang that is not an array of strings — %o", (ru, got) => {
    expect(() => createLocalizedSeo(shaped(ru))).toThrow(`[seo] Locale "ru" needs hreflang as an array of strings; ${got}`);
  });

  it.each([
    [{ prefix: "ru", hreflang: ["ru"] }, "got undefined."],
    [{ prefix: "ru", hreflang: ["ru"], ogLocale: " " }, 'got " ".'],
    [{ prefix: "ru", hreflang: ["ru"], ogLocale: 1 }, "got 1."],
  ])("throws on an ogLocale that is not a non-blank string — %o", (ru, got) => {
    expect(() => createLocalizedSeo(shaped(ru))).toThrow(`[seo] Locale "ru" needs a non-blank ogLocale; ${got}`);
  });

  it("names the problem", () => {
    expect(() => createLocalizedSeo({ ...MOSBUILD, defaultLocale: "zh-cn" })).toThrow(
      '[seo] defaultLocale "zh-cn" is not one of the configured locales (en, zh-CN).',
    );
  });

  it("accepts the Mosbuild config", () => {
    expect(() => createLocalizedSeo(MOSBUILD)).not.toThrow();
    expect(() => createLocalizedSeo(THREE)).not.toThrow();
    expect(() => createLocalizedSeo(RED_SEA)).not.toThrow();
  });
});

describe("an unknown locale", () => {
  const seo = createLocalizedSeo(MOSBUILD);

  it("is clamped to the default and logged, never thrown", () => {
    const md = seo.forLocale("zh-cn").generateSEOMetadata(null, "about");
    expect(md.alternates.canonical).toBe("https://mosbuildexpo.com/about/");
    expect(md.openGraph.locale).toBe("en_US");
    expect(logged).toEqual([
      '[seo] Unknown locale "zh-cn"; falling back to "en". Configured locales: en, zh-CN.',
    ]);
  });

  it("is clamped by localizedRoute and localizedUrl too", () => {
    expect(seo.localizedRoute("about", "fr")).toBe("about");
    expect(seo.localizedUrl("about", "fr")).toBe("https://mosbuildexpo.com/about/");
    expect(logged).toHaveLength(2);
  });
});

describe("a prefixed default locale", () => {
  const seo = createLocalizedSeo(RED_SEA);
  const en = seo.forLocale("en").generateSEOMetadata;

  it("keeps the prefix on the default locale's home and pages", () => {
    expect(en(null, "").alternates.canonical).toBe("https://www.shebara.sa/en/");
    expect(en(null, "/en/dining/").alternates.canonical).toBe("https://www.shebara.sa/en/dining/");
    expect(seo.localizedUrl("", "ar")).toBe("https://www.shebara.sa/ar/");
  });

  it("emits hreflang with x-default on the prefixed default", () => {
    const md = seo.forLocale("ar").generateSEOMetadata(null, "dining", undefined, { alternates: { en: "dining" } });
    expect(Object.entries(md.alternates.languages ?? {})).toEqual([
      ["en", "https://www.shebara.sa/en/dining/"],
      ["ar", "https://www.shebara.sa/ar/dining/"],
      ["x-default", "https://www.shebara.sa/en/dining/"],
    ]);
  });

  it("guards canonicals by prefix", () => {
    expect(en({ canonicalURL: "https://www.shebara.sa/ar/dining/" }, "dining").alternates.canonical).toBe(
      "https://www.shebara.sa/en/dining/",
    );
    expect(en({ canonicalURL: "https://www.shebara.sa/dining/" }, "dining").alternates.canonical).toBe(
      "https://www.shebara.sa/en/dining/",
    );
    expect(en({ canonicalURL: "https://www.shebara.sa/en/" }, "dining").alternates.canonical).toBe(
      "https://www.shebara.sa/en/dining/",
    );
    expect(en({ canonicalURL: "https://www.shebara.sa/en/" }, "").alternates.canonical).toBe(
      "https://www.shebara.sa/en/",
    );
    expect(en({ canonicalURL: "https://www.shebara.sa/en/spa/" }, "dining").alternates.canonical).toBe(
      "https://www.shebara.sa/en/spa/",
    );
    expect(logged).toEqual([
      '[seo] Ignoring CMS canonicalURL "https://www.shebara.sa/ar/dining/" on /en/dining/; it belongs to locale "ar".',
      '[seo] Ignoring CMS canonicalURL "https://www.shebara.sa/dining/" on /en/dining/; it is outside every locale.',
      '[seo] Ignoring CMS canonicalURL "https://www.shebara.sa/en/" on /en/dining/; a sub-page must not declare its locale home as its canonical.',
    ]);
  });
});

describe("alternatesFromLocalizations", () => {
  it("skips unpublished rows", () => {
    expect(
      alternatesFromLocalizations(
        [
          { locale: "zh-CN", publishedAt: "2026-09-29T08:00:00.000Z", Slug: "b" },
          { locale: "ru", publishedAt: null, Slug: "c" },
          { locale: "de", Slug: "d" },
        ],
        (l) => `articles/${l.Slug}`,
      ),
    ).toEqual({ "zh-CN": "articles/b" });
  });

  it('keeps "" for a home', () => {
    expect(alternatesFromLocalizations([{ locale: "en", publishedAt: "2026-09-29" }], () => "")).toEqual({ en: "" });
  });

  it("handles null and undefined", () => {
    expect(alternatesFromLocalizations(null, () => "x")).toEqual({});
    expect(alternatesFromLocalizations(undefined, () => "x")).toEqual({});
  });

  it("keeps the first published row of a locale", () => {
    expect(
      alternatesFromLocalizations(
        [
          { locale: "en", publishedAt: null, Slug: "draft" },
          { locale: "en", publishedAt: "2026-09-29", Slug: "a" },
          { locale: "en", publishedAt: "2026-09-29", Slug: "b" },
        ],
        (l) => l.Slug,
      ),
    ).toEqual({ en: "a" });
  });

  it("feeds generateSEOMetadata", () => {
    const alternates = alternatesFromLocalizations(
      [{ locale: "en", publishedAt: "2026-09-29", Slug: "a" }],
      (l) => `articles/${l.Slug}`,
    );
    const md = createLocalizedSeo(MOSBUILD)
      .forLocale("zh-CN")
      .generateSEOMetadata(null, "articles/b", undefined, { alternates });
    expect(md.alternates.languages?.en).toBe("https://mosbuildexpo.com/articles/a/");
  });
});

describe("the shared locale config cases", () => {
  const create = ({ defaultLocale, locales }: LocaleConfigCase) => () =>
    createLocalizedSeo({ ...SITE, defaultLocale, locales } as unknown as LocalizedSeoConfig);

  const thrownMessage = (run: () => unknown): string => {
    try {
      run();
    } catch (error) {
      return (error as Error).message;
    }
    return "nothing was thrown";
  };

  it.each(INVALID_LOCALE_CONFIGS)("throws on $name", (entry) => {
    const message = thrownMessage(create(entry));
    expect(message).toMatch(/^\[seo\] /);
    expect(message.slice("[seo] ".length)).toMatch(entry.message);
  });

  it.each(VALID_LOCALE_CONFIGS)("accepts $name", (entry) => {
    expect(create(entry)).not.toThrow();
  });
});

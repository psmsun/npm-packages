/**
 * The `./bilingual` entry: locales, per-locale defaults, inheritance, the canonical
 * sanitizer, the noIndex parser, metaImage shapes and hiddenBuildEnv.
 *
 * This entry is always strict — there is no policy option to pass, because the four Red Sea
 * sites have no use for the loose behaviour and an option is one more thing to set wrong.
 * The main entry's 2.0 behaviour is covered in `mainEntryUnchanged.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBilingualSeo, parseNoIndex } from "./bilingual.js";

const RS = {
  siteUrl: "https://www.shebara.sa",
  siteName: "Shebara",
  locales: { all: ["en", "ar"], default: "en", ogLocale: { en: "en_US", ar: "ar_SA" } },
  defaults: {
    en: { title: "Shebara", description: "EN default." },
    ar: { title: "شيبارا", description: "AR default." },
  },
} as const;

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    logged.push(a.join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

describe("locales", () => {
  const seo = createBilingualSeo(RS);

  it("puts the locale in the URL and emits the hreflang set", () => {
    const md = seo.forLocale("ar").generateSEOMetadata(null, "dining");
    expect(md.alternates.canonical).toBe("https://www.shebara.sa/ar/dining/");
    expect(md.alternates.languages).toEqual({
      en: "https://www.shebara.sa/en/dining/",
      ar: "https://www.shebara.sa/ar/dining/",
      "x-default": "https://www.shebara.sa/en/dining/",
    });
    expect(md.openGraph.locale).toBe("ar_SA");
    expect(md.openGraph.alternateLocale).toEqual(["en_US"]);
    expect(md.title.absolute).toBe("شيبارا");
    expect(md.description).toBe("AR default.");
    expect(md.openGraph.siteName).toBe("شيبارا");
  });

  it("omits an empty keywords instead of emitting the key", () => {
    expect("keywords" in seo.forLocale("en").generateSEOMetadata({ keywords: "" }, "a")).toBe(false);
    expect("keywords" in seo.forLocale("en").generateSEOMetadata({}, "a")).toBe(false);
    expect(seo.forLocale("en").generateSEOMetadata({ keywords: "a, b" }, "a").keywords).toBe("a, b");
  });

  it("strips ANY configured locale prefix, not just the current one", () => {
    const md = seo.forLocale("ar").generateSEOMetadata(null, "en/dining");
    expect(md.alternates.canonical).toBe("https://www.shebara.sa/ar/dining/");
    expect(md.alternates.languages.en).toBe("https://www.shebara.sa/en/dining/");
    expect(seo.forLocale("en").generateSEOMetadata(null, "/ar/dining/").alternates.canonical).toBe("https://www.shebara.sa/en/dining/");
  });

  it("does not strip a slug that merely starts with a locale's letters", () => {
    expect(seo.forLocale("en").generateSEOMetadata(null, "entertainment").alternates.canonical).toBe("https://www.shebara.sa/en/entertainment/");
  });

  it("clamps an unconfigured locale to the default and says so", () => {
    const md = seo.forLocale("fr").generateSEOMetadata(null, "dining");
    expect(md.alternates.canonical).toBe("https://www.shebara.sa/en/dining/");
    expect(md.openGraph.locale).toBe("en_US");
    expect(logged.join("\n")).toContain('Unknown locale "fr"');
  });

  it("never throws on an unconfigured locale — generateMetadata must not fail a build", () => {
    expect(() => seo.forLocale("zz").generateSEOMetadata(null, "x")).not.toThrow();
    expect(() => seo.forLocale(undefined).generateSEOMetadata(null, "x")).not.toThrow();
  });

  it("an omitted locale uses the default and logs nothing", () => {
    expect(seo.forLocale(undefined).generateSEOMetadata(null, "dining").alternates.canonical).toBe("https://www.shebara.sa/en/dining/");
    expect(logged).toEqual([]);
  });

  it("a blank metaTitle falls back to the locale default, then to siteName", () => {
    expect(seo.forLocale("en").generateSEOMetadata({ metaTitle: "   " }, "a").title.absolute).toBe("Shebara");
    const bare = createBilingualSeo({ siteUrl: RS.siteUrl, siteName: "Fallback", locales: RS.locales });
    expect(bare.forLocale("en").generateSEOMetadata({ metaTitle: "  " }, "a").title.absolute).toBe("Fallback");
  });

  it("omits description entirely when neither the CMS nor a default supplies one", () => {
    const bare = createBilingualSeo({ siteUrl: RS.siteUrl, siteName: "X", locales: RS.locales });
    const md = bare.forLocale("en").generateSEOMetadata({ metaDescription: "   " }, "a");
    expect("description" in md).toBe(false);
    expect(md.openGraph).not.toHaveProperty("description");
  });

  // Stated so the blind spot is on the record: the goldens never pass a third argument, so
  // nothing else in this suite would notice if one were silently honoured.
  it("ignores a third argument — there is no pageData chain on this entry", () => {
    const withPageData = (
      seo.forLocale("en").generateSEOMetadata as unknown as (
        s: unknown,
        p: string,
        d: unknown,
      ) => { title: { absolute: string }; description?: string }
    )(null, "a", { Title: "From pageData", Excerpt: "Summary from pageData" });
    expect(withPageData.title.absolute).toBe("Shebara");
    expect(withPageData.description).toBe("EN default.");
  });

  it("available narrows the hreflang set without touching the canonical", () => {
    const md = seo
      .forLocale("en", { available: ["en"] })
      .generateSEOMetadata(null, "saudi-national-day-2025");
    expect(md.alternates.languages).toEqual({
      en: "https://www.shebara.sa/en/saudi-national-day-2025/",
      "x-default": "https://www.shebara.sa/en/saudi-national-day-2025/",
    });
    expect(md.openGraph.alternateLocale).toBeUndefined();
    expect(md.alternates.canonical).toBe("https://www.shebara.sa/en/saudi-national-day-2025/");
  });

  it("x-default falls to the first available locale when the default is missing", () => {
    const md = seo.forLocale("ar", { available: ["ar"] }).generateSEOMetadata(null, "x");
    expect(md.alternates.languages["x-default"]).toBe("https://www.shebara.sa/ar/x/");
  });
});

describe("canonical sanitizing (always on)", () => {
  const seo = createBilingualSeo(RS);
  const canonical = (v: unknown, path = "dining", locale = "en") =>
    seo.forLocale(locale).generateSEOMetadata({ canonicalURL: v } as never, path).alternates.canonical;

  it("accepts an absolute same-origin https URL", () => {
    expect(canonical("https://www.shebara.sa/en/other/")).toBe("https://www.shebara.sa/en/other/");
    expect(logged).toEqual([]);
  });

  it("rejects a relative value", () => {
    expect(canonical("/about")).toBe("https://www.shebara.sa/en/dining/");
    expect(logged.join("\n")).toContain("malformed");
  });

  it("rejects the email address that reached production", () => {
    expect(canonical("seoteam@acronym.com")).toBe("https://www.shebara.sa/en/dining/");
    expect(logged.join("\n")).toContain("malformed");
  });

  it("rejects an off-site URL", () => {
    expect(canonical("https://example.com/x")).toBe("https://www.shebara.sa/en/dining/");
    expect(logged.join("\n")).toContain("off-site");
  });

  it("rejects http on an https site and never upgrades it silently", () => {
    expect(canonical("http://www.shebara.sa/en/dining/")).toBe("https://www.shebara.sa/en/dining/");
    expect(logged.join("\n")).toContain("expected scheme https:");
  });

  it("rejects a non-http protocol", () => {
    expect(canonical("mailto:seoteam@acronym.com")).toBe("https://www.shebara.sa/en/dining/");
    expect(logged.join("\n")).toContain("unsupported protocol");
  });

  it("rejects a blank or absent value silently — nothing was typed, nothing to report", () => {
    expect(canonical("  ")).toBe("https://www.shebara.sa/en/dining/");
    expect(canonical(null)).toBe("https://www.shebara.sa/en/dining/");
    expect(canonical(undefined)).toBe("https://www.shebara.sa/en/dining/");
    expect(logged).toEqual([]);
  });

  it("rejects the site root claimed by a sub-path", () => {
    expect(canonical("https://www.shebara.sa")).toBe("https://www.shebara.sa/en/dining/");
    expect(canonical("https://www.shebara.sa/")).toBe("https://www.shebara.sa/en/dining/");
    expect(logged.join("\n")).toContain("must not declare the homepage as its canonical");
  });

  it("rejects EITHER locale home claimed by a sub-path — /en/ is the real homepage here", () => {
    expect(canonical("https://www.shebara.sa/en/", "dining", "en")).toBe("https://www.shebara.sa/en/dining/");
    expect(canonical("https://www.shebara.sa/ar/", "dining", "ar")).toBe("https://www.shebara.sa/ar/dining/");
    // The other locale's home is just as wrong a claim as this one's.
    expect(canonical("https://www.shebara.sa/ar/", "dining", "en")).toBe("https://www.shebara.sa/en/dining/");
    expect(logged.filter((l) => l.includes("must not declare")).length).toBe(3);
  });

  it("allows a locale home ON that locale's home page", () => {
    expect(canonical("https://www.shebara.sa/en/", "", "en")).toBe("https://www.shebara.sa/en/");
    expect(logged).toEqual([]);
  });

  it("logs on console.error, because two Red Sea sites strip console.warn in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    canonical("/about");
    expect(warn).not.toHaveBeenCalled();
    expect(logged.length).toBe(1);
  });
});

describe("parseNoIndex", () => {
  it("accepts an affirmative value or metaRobots", () => {
    expect(parseNoIndex({ noIndex: true })).toEqual({ noIndex: true, follow: false });
    expect(parseNoIndex({ NoIndex: true })).toEqual({ noIndex: true, follow: false });
    expect(parseNoIndex({ noIndex: 1 })).toEqual({ noIndex: true, follow: false });
    expect(parseNoIndex({ noIndex: "YES" })).toEqual({ noIndex: true, follow: false });
    expect(parseNoIndex({ metaRobots: "noindex, nofollow" })).toEqual({ noIndex: true, follow: false });
  });

  it("keeps follow when metaRobots says so", () => {
    expect(parseNoIndex({ metaRobots: "noindex, follow" })).toEqual({ noIndex: true, follow: true });
    expect(parseNoIndex({ robots: "NOINDEX" })).toEqual({ noIndex: true, follow: true });
  });

  it("treats an explicit negative as an answer, without falling through to metaRobots", () => {
    expect(parseNoIndex({ noIndex: "false", metaRobots: "noindex" })).toEqual({ noIndex: false, follow: true });
    expect(parseNoIndex({ noIndex: "no" })).toEqual({ noIndex: false, follow: true });
    expect(parseNoIndex({ noIndex: "0" })).toEqual({ noIndex: false, follow: true });
  });

  it("indexes anything it does not understand", () => {
    expect(parseNoIndex(null).noIndex).toBe(false);
    expect(parseNoIndex(undefined).noIndex).toBe(false);
    expect(parseNoIndex("string").noIndex).toBe(false);
    expect(parseNoIndex({}).noIndex).toBe(false);
    expect(parseNoIndex({ noIndex: false }).noIndex).toBe(false);
    expect(parseNoIndex({ noIndex: "" }).noIndex).toBe(false);
  });

  it("carries the follow flag into googleBot too", () => {
    const seo = createBilingualSeo(RS);
    expect(seo.forLocale("en").generateSEOMetadata({ metaRobots: "noindex, follow" }, "a").robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
  });
});

describe("metaImage", () => {
  const seo = createBilingualSeo(RS);
  const img = (metaImage: unknown) =>
    seo.forLocale("en").generateSEOMetadata({ metaImage } as never, "a").openGraph.images?.[0]?.url;

  it("resolves the flat v5 shape and prefixes the site URL", () => {
    expect(img({ url: "/uploads/x.jpg" })).toBe("https://www.shebara.sa/uploads/x.jpg");
    expect(img({ url: "uploads/x.jpg" })).toBe("https://www.shebara.sa/uploads/x.jpg");
  });

  it("passes an absolute URL through", () => {
    expect(img({ url: "http://cdn.example.com/z.jpg" })).toBe("http://cdn.example.com/z.jpg");
  });

  it("resolves the nested v4 shape and its formats.large fallback", () => {
    expect(img({ data: { attributes: { url: "/uploads/y.jpg" } } })).toBe("https://www.shebara.sa/uploads/y.jpg");
    expect(img({ data: { attributes: { formats: { large: { url: "/uploads/l.jpg" } } } } })).toBe("https://www.shebara.sa/uploads/l.jpg");
  });

  it("yields no image for an empty or absent shape", () => {
    expect(img({ data: null })).toBeUndefined();
    expect(img({})).toBeUndefined();
    expect(img(null)).toBeUndefined();
    expect(img({ url: "" })).toBeUndefined();
  });

  // No current consumer can produce both — the v5 sites never have `data`, the v4 sites
  // never have a flat `url` — so nothing observable depends on the order today. Pinned
  // precisely because nothing else would catch it changing.
  it("prefers the flat url when both shapes are present, matching the main entry", () => {
    expect(img({ url: "/uploads/flat.jpg", data: { attributes: { url: "/uploads/nested.jpg" } } })).toBe("https://www.shebara.sa/uploads/flat.jpg");
  });
});

describe("hiddenBuildEnv", () => {
  const rules = [
    { name: "NODE_ENV", equals: "development" },
    { name: "VERCEL_ENV", equals: "preview" },
    { name: "NEXT_PUBLIC_ROBOTS_NOINDEX", equals: "1" },
  ];

  it("does nothing when the env does not match", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(createBilingualSeo({ ...RS, hiddenBuildEnv: rules }).forLocale("en").generateSEOMetadata(null, "a").robots.index).toBe(true);
    vi.unstubAllEnvs();
  });

  it("makes the whole build noindex,nofollow when a rule matches", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(createBilingualSeo({ ...RS, hiddenBuildEnv: rules }).forLocale("en").generateSEOMetadata(null, "a").robots).toEqual({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    });
    vi.unstubAllEnvs();
  });

  it("overrides an otherwise indexable page, and is not consulted when unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_ROBOTS_NOINDEX", "1");
    expect(createBilingualSeo({ ...RS, hiddenBuildEnv: rules }).forLocale("en").generateSEOMetadata({ noIndex: false }, "a").robots.index).toBe(false);
    expect(createBilingualSeo(RS).forLocale("en").generateSEOMetadata({ noIndex: false }, "a").robots.index).toBe(true);
    vi.unstubAllEnvs();
  });

  it("reads no env var at all when the list is empty", () => {
    const spy = vi.spyOn(process, "env", "get");
    createBilingualSeo(RS).forLocale("en").generateSEOMetadata(null, "a");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("inherit / loadHomepageSeo", () => {
  const homepage = {
    metaTitle: "Home",
    metaDescription: "Home desc",
    metaImage: { url: "/uploads/home.jpg" },
    keywords: "home",
    canonicalURL: "https://www.shebara.sa/en/",
    JSON_LD: '{"@type":"Resort"}',
    noIndex: true,
  };

  it("inherits nothing by default, and never calls the loader", async () => {
    const load = vi.fn(async () => homepage);
    const seo = createBilingualSeo({ ...RS, loadHomepageSeo: load });
    await expect(seo.forLocale("en").resolvePageSeo(undefined)).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it("copies only the allowlist, and passes the locale to the loader", async () => {
    const load = vi.fn(async (_l?: string) => homepage);
    const seo = createBilingualSeo({
      ...RS,
      inherit: ["metaTitle", "metaDescription", "metaImage"],
      loadHomepageSeo: load,
    });
    expect(await seo.forLocale("ar").resolvePageSeo(undefined)).toEqual({
      metaTitle: "Home",
      metaDescription: "Home desc",
      metaImage: { url: "/uploads/home.jpg" },
    });
    expect(load).toHaveBeenCalledWith("ar");
  });

  it("never carries canonicalURL, JSON_LD, noIndex or keywords across", async () => {
    const seo = createBilingualSeo({
      ...RS,
      inherit: ["metaTitle", "metaDescription", "metaImage"],
      loadHomepageSeo: async () => homepage,
    });
    const resolved = await seo.forLocale("en").resolvePageSeo(undefined);
    for (const forbidden of ["canonicalURL", "JSON_LD", "noIndex", "keywords"]) {
      expect(resolved).not.toHaveProperty(forbidden);
    }
  });

  it("a page with its own seo is returned untouched and blocks inheritance", async () => {
    const load = vi.fn(async () => homepage);
    const seo = createBilingualSeo({ ...RS, inherit: ["metaTitle"], loadHomepageSeo: load });
    const own = { metaTitle: "Mine" };
    await expect(seo.forLocale("en").resolvePageSeo(own)).resolves.toBe(own);
    // Documented, and an open question for the content team: an empty seo component from
    // Strapi stops inheritance just as a populated one does.
    await expect(seo.forLocale("en").resolvePageSeo({})).resolves.toEqual({});
    expect(load).not.toHaveBeenCalled();
  });

  it("returns undefined rather than an empty object when nothing survives", async () => {
    const seo = createBilingualSeo({
      ...RS,
      inherit: ["metaTitle"],
      loadHomepageSeo: async () => ({ canonicalURL: "https://www.shebara.sa/en/" }),
    });
    await expect(seo.forLocale("en").resolvePageSeo(null)).resolves.toBeUndefined();
  });

  it("survives a homepage loader that returns nothing usable", async () => {
    for (const value of [undefined, null, "", 42]) {
      const seo = createBilingualSeo({
        ...RS,
        inherit: ["metaTitle"],
        loadHomepageSeo: async () => value,
      });
      await expect(seo.forLocale("en").resolvePageSeo(undefined)).resolves.toBeUndefined();
    }
  });
});

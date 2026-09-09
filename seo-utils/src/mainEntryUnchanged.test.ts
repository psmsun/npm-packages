/**
 * The main entry must stay 2.0 while `./bilingual` exists beside it.
 *
 * `src/seo.ts` is byte-identical to HEAD and the 109 original tests pass unedited, which is
 * the primary proof. These are the complement: they assert the properties that would break
 * first if the bilingual layer ever leaked back into `createSeo` — an hreflang set
 * appearing, the `keywords` key being dropped, an env var being read, a CMS canonical
 * being validated, a locale-looking path segment being stripped.
 */

import { describe, expect, it, vi } from "vitest";
import { createSeo } from "./seo.js";

const ITE = { siteUrl: "https://expopharmtech.com", siteName: "Pharmtech" };

describe("the main entry is still 2.0", () => {
  const { generateSEOMetadata } = createSeo(ITE);

  it("returns only createSeo's 2.0 surface — no forLocale, no resolvePageSeo", () => {
    expect(Object.keys(createSeo(ITE)).sort()).toEqual(["generateSEOMetadata"]);
  });

  it("emits no hreflang languages and no alternateLocale", () => {
    const md = generateSEOMetadata(null, "about");
    expect(md.alternates).toEqual({ canonical: "https://expopharmtech.com/about/" });
    expect("languages" in md.alternates).toBe(false);
    expect(md.openGraph).not.toHaveProperty("alternateLocale");
  });

  it("keeps the keywords key even when there is no value", () => {
    const md = generateSEOMetadata(null, "about");
    expect("keywords" in md).toBe(true);
    expect(md.keywords).toBeUndefined();
  });

  it("uses the configured Open Graph locale and site name, not a per-locale default", () => {
    expect(generateSEOMetadata(null, "a").openGraph.locale).toBe("en_US");
    expect(createSeo({ ...ITE, locale: "ru_RU" }).generateSEOMetadata(null, "a").openGraph.locale).toBe("ru_RU");
    expect(generateSEOMetadata(null, "a").openGraph.siteName).toBe("Pharmtech");
  });

  it("reads no environment variable", () => {
    const spy = vi.spyOn(process, "env", "get");
    generateSEOMetadata({ metaTitle: "x" }, "about");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("passes a CMS canonical through unchecked — no sanitizer on this entry", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(generateSEOMetadata({ canonicalURL: "/about" }, "x").alternates.canonical).toBe("/about");
    expect(generateSEOMetadata({ canonicalURL: "https://elsewhere.test/y" }, "x").alternates.canonical).toBe("https://elsewhere.test/y");
    expect(generateSEOMetadata({ canonicalURL: "http://expopharmtech.com/z/" }, "x").alternates.canonical).toBe("http://expopharmtech.com/z/");
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("still ignores a root canonical on a sub-path, and keeps it on the root", () => {
    expect(generateSEOMetadata({ canonicalURL: "https://expopharmtech.com/" }, "about").alternates.canonical).toBe("https://expopharmtech.com/about/");
    expect(generateSEOMetadata({ canonicalURL: "https://expopharmtech.com/" }, "").alternates.canonical).toBe("https://expopharmtech.com/");
  });

  it("keeps the loose noIndex test, including its two known wrong answers", () => {
    expect(generateSEOMetadata({ noIndex: true }, "a").robots.index).toBe(false);
    // Wrong, and deliberately left wrong here: fixing it is an ITE-driven release.
    expect(generateSEOMetadata({ noIndex: "false" } as never, "a").robots.index).toBe(false);
    expect(generateSEOMetadata({ metaRobots: "noindex" }, "a").robots.index).toBe(true);
  });

  it("does not strip a path segment that happens to look like a locale", () => {
    expect(generateSEOMetadata(null, "en/dining").alternates.canonical).toBe("https://expopharmtech.com/en/dining/");
    expect(generateSEOMetadata(null, "/ar/dining/").alternates.canonical).toBe("https://expopharmtech.com/ar/dining/");
  });

  it("resolves only the flat metaImage shape", () => {
    expect(generateSEOMetadata({ metaImage: { url: "/u/x.jpg" } }, "a").openGraph.images?.[0].url).toBe("https://expopharmtech.com/u/x.jpg");
    expect(generateSEOMetadata({ metaImage: { data: { attributes: { url: "/u/y.jpg" } } } } as never, "a").openGraph.images).toBeUndefined();
  });

  it("keeps the pageData title and description chain", () => {
    const md = generateSEOMetadata(null, "a", { Header: { Title: "Industry Insights // Hub" }, Excerpt: "A summary." });
    expect(md.title.absolute).toBe("Industry Insights Hub");
    expect(md.description).toBe("A summary.");
  });
});

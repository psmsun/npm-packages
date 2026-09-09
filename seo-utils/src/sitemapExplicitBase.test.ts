/**
 * `./bilingual/sitemap`: createLocaleSitemapNoIndex and the hreflang helper.
 *
 * `./sitemap`'s redirects-URL mode is a separate module and a separate test file
 * (`sitemap.test.ts`, unedited) — the point of splitting the entry was that the ITE
 * helper stays exactly as it is.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocaleSitemapNoIndex,
  localeAlternateRefs,
  normalizeSitemapPath,
} from "./bilingualSitemap.js";

function v5row(extra: Record<string, unknown>) {
  return { id: 1, documentId: "abc", ...extra };
}
function v4row(extra: Record<string, unknown>) {
  return { id: 1, attributes: { ...extra } };
}

/** A Strapi stand-in serving one single type and one collection per locale. */
function cms(shape: "v4" | "v5") {
  const mk = shape === "v4" ? v4row : v5row;
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    const locale = u.searchParams.get("locale");
    let body: unknown;
    if (u.pathname.endsWith("/api/campaign-pages")) {
      body = {
        data: [
          mk({ Path: "keep-me", seo: { noIndex: false } }),
          mk({ Path: "/drop-me/", seo: { noIndex: true } }),
          mk({ Path: "robots-drop", seo: { metaRobots: "noindex, nofollow" } }),
          mk({ Path: "no-seo" }),
        ],
      };
    } else if (u.pathname.endsWith("/api/homepage")) {
      body = { data: mk({ seo: { noIndex: locale === "ar" } }) };
    } else {
      body = { data: mk({ seo: { noIndex: false } }) };
    }
    return { ok: true, json: async () => body };
  };
  return { fetch, calls };
}

const SITE = {
  apiBase: "https://prod-shebara-cms.prismetic.com",
  locales: ["en", "ar"],
  singleTypes: [
    { uid: "homepage", segments: [] as string[] },
    { uid: "dining", segments: ["dining"] },
  ],
  collections: [{ uid: "campaign-pages", field: "Path" }],
};

let errors: string[];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    errors.push(a.join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

describe("explicit-base mode", () => {
  it.each(["v4", "v5"] as const)("collects the noIndex set from a %s box", async (shape) => {
    const box = cms(shape);
    const { getNoIndexPathSetPromise } = createLocaleSitemapNoIndex({
      ...SITE,
      shape,
      fetch: box.fetch,
    });
    const set = await getNoIndexPathSetPromise();
    expect([...set].sort()).toEqual([
      "/ar",
      "/ar/drop-me",
      "/ar/robots-drop",
      "/en/drop-me",
      "/en/robots-drop",
    ]);
    expect(errors).toEqual([]);
  });

  it("sends the populate syntax that matches the shape", async () => {
    const v4 = cms("v4");
    await createLocaleSitemapNoIndex({ ...SITE, shape: "v4", fetch: v4.fetch }).getNoIndexPathSetPromise();
    expect(v4.calls.every((u) => u.includes("populate%5Bseo%5D=true"))).toBe(true);

    const v5 = cms("v5");
    await createLocaleSitemapNoIndex({ ...SITE, shape: "v5", fetch: v5.fetch }).getNoIndexPathSetPromise();
    expect(v5.calls.every((u) => u.includes("populate%5B0%5D=seo"))).toBe(true);
  });

  it.each([
    ["v4", "v5"],
    ["v5", "v4"],
  ] as const)("a %s config against a %s box yields an empty set AND says so", async (shape, boxShape) => {
    const box = cms(boxShape);
    const { getNoIndexPathSetPromise } = createLocaleSitemapNoIndex({
      ...SITE,
      shape,
      fetch: box.fetch,
    });
    const set = await getNoIndexPathSetPromise();
    expect([...set]).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain(`shape is "${shape}"`);
    expect(errors.join("\n")).toContain("silently skipped");
  });

  it("caches, so the transform hook can call it once per path", async () => {
    const box = cms("v4");
    const { getNoIndexPathSetPromise } = createLocaleSitemapNoIndex({ ...SITE, shape: "v4", fetch: box.fetch });
    await Promise.all([getNoIndexPathSetPromise(), getNoIndexPathSetPromise()]);
    await getNoIndexPathSetPromise();
    // 2 locales × (2 single types + 1 collection)
    expect(box.calls).toHaveLength(6);
  });

  it("merges extra paths from the configured env var", async () => {
    vi.stubEnv("SITEMAP_NOINDEX_PATHS", "/en/internal, /ar/internal/ , , /");
    const box = cms("v4");
    const set = await createLocaleSitemapNoIndex({
      ...SITE,
      shape: "v4",
      fetch: box.fetch,
      extraPathsEnv: "SITEMAP_NOINDEX_PATHS",
    }).getNoIndexPathSetPromise();
    expect(set.has("/en/internal")).toBe(true);
    expect(set.has("/ar/internal")).toBe(true);
    expect(set.has("/")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("ignores the env var when none is configured", async () => {
    vi.stubEnv("SITEMAP_NOINDEX_PATHS", "/en/internal");
    const box = cms("v4");
    const set = await createLocaleSitemapNoIndex({ ...SITE, shape: "v4", fetch: box.fetch }).getNoIndexPathSetPromise();
    expect(set.has("/en/internal")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("survives a dead CMS without failing the build", async () => {
    const set = await createLocaleSitemapNoIndex({
      ...SITE,
      shape: "v4",
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    }).getNoIndexPathSetPromise();
    expect([...set]).toEqual([]);
    expect(errors.join("\n")).toContain("noIndex fetch failed");
  });

  it("honours a collection prefix", async () => {
    const box = cms("v4");
    const set = await createLocaleSitemapNoIndex({
      ...SITE,
      shape: "v4",
      fetch: box.fetch,
      collections: [{ uid: "campaign-pages", field: "Path", prefix: "offers" }],
    }).getNoIndexPathSetPromise();
    expect(set.has("/en/offers/drop-me")).toBe(true);
  });

  it("the exclusion set is keyed the way normalizeSitemapPath reads a sitemap path", async () => {
    const box = cms("v4");
    const { getNoIndexPathSetPromise } = createLocaleSitemapNoIndex({ ...SITE, shape: "v4", fetch: box.fetch });
    const set = await getNoIndexPathSetPromise();
    for (const p of ["/en/drop-me/", "/en/drop-me", "/ar/", "/ar"]) {
      expect(set.has(normalizeSitemapPath(p))).toBe(true);
    }
    for (const p of ["/en/keep-me/", "/en/"]) {
      expect(set.has(normalizeSitemapPath(p))).toBe(false);
    }
  });
});

describe("localeAlternateRefs", () => {
  const SITE_URL = "https://www.shebara.sa";

  it("reproduces the fleet's transform output exactly", () => {
    expect(localeAlternateRefs(SITE_URL, "/en/dining/", ["en", "ar"])).toEqual([
      { href: "https://www.shebara.sa/en/dining/", hreflang: "en", hrefIsAbsolute: true },
      { href: "https://www.shebara.sa/ar/dining/", hreflang: "ar", hrefIsAbsolute: true },
      { href: "https://www.shebara.sa/en/dining/", hreflang: "x-default", hrefIsAbsolute: true },
    ]);
  });

  it("gives every href a trailing slash, which is what keeps the cluster reciprocal", () => {
    const refs = localeAlternateRefs(SITE_URL, "/ar/dining", ["en", "ar"]);
    expect(refs.every((r) => r.href.endsWith("/"))).toBe(true);
  });

  it("treats a path with no locale prefix as the locale homepages", () => {
    expect(localeAlternateRefs(SITE_URL, "/", ["en", "ar"]).map((r) => r.href)).toEqual([
      "https://www.shebara.sa/en/",
      "https://www.shebara.sa/ar/",
      "https://www.shebara.sa/en/",
    ]);
  });

  it("does not mistake a page slug for a locale segment", () => {
    expect(localeAlternateRefs(SITE_URL, "/entertainment/x/", ["en", "ar"])[0].href).toBe("https://www.shebara.sa/en/");
  });

  it("strips a trailing site-url slash", () => {
    expect(localeAlternateRefs("https://www.shebara.sa/", "/en/x/", ["en", "ar"])[0].href).toBe("https://www.shebara.sa/en/x/");
  });

  // desertrock ships /ar/saudi-national-day-2025/ as an alternate although no such page is
  // exported and it is not in the sitemap's own <loc> set. existsIn is how a site stops that.
  it("omits a locale the page was never translated into", () => {
    const refs = localeAlternateRefs(SITE_URL, "/en/saudi-national-day-2025/", ["en", "ar"], {
      existsIn: (locale) => locale === "en",
    });
    expect(refs.map((r) => r.hreflang)).toEqual(["en", "x-default"]);
    expect(refs.every((r) => r.href.includes("/en/"))).toBe(true);
  });

  it("drops x-default when its locale is not available", () => {
    const refs = localeAlternateRefs(SITE_URL, "/ar/x/", ["en", "ar"], {
      existsIn: (locale) => locale === "ar",
    });
    expect(refs.map((r) => r.hreflang)).toEqual(["ar"]);
  });

  it("accepts an explicit x-default locale", () => {
    const refs = localeAlternateRefs(SITE_URL, "/en/x/", ["en", "ar"], { xDefault: "ar" });
    expect(refs.at(-1)).toEqual({ href: "https://www.shebara.sa/ar/x/", hreflang: "x-default", hrefIsAbsolute: true });
  });
});

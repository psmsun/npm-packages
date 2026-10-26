/**
 * The two opt-in policies on the main entry. Both are additive: with no policy passed,
 * `mainEntryUnchanged.test.ts` and the 109 originals prove the output is what 2.0 shipped.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeo } from "./seo.js";

const ITE = { siteUrl: "https://expopharmtech.com", siteName: "Pharmtech" };

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    logged.push(a.join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

describe('canonicalPolicy: "strict-same-origin"', () => {
  const { generateSEOMetadata } = createSeo({
    ...ITE,
    canonicalPolicy: "strict-same-origin",
  });
  const canonical = (v: unknown, path = "about") =>
    generateSEOMetadata({ canonicalURL: v } as never, path).alternates.canonical;

  const COMPUTED = "https://expopharmtech.com/about/";

  it("accepts a well-formed same-origin canonical", () => {
    expect(canonical("https://expopharmtech.com/other/")).toBe("https://expopharmtech.com/other/");
    expect(logged).toEqual([]);
  });

  it("accepts a value with a trailing space — editors paste them constantly", () => {
    expect(canonical("https://expopharmtech.com/other/  ")).toBe("https://expopharmtech.com/other/");
    expect(canonical("  https://expopharmtech.com/other/")).toBe("https://expopharmtech.com/other/");
    expect(logged).toEqual([]);
  });

  // Found by running all 1,876 fleet canonicals through the real sanitizer: three
  // homepage rows store the bare origin with no path at all. `new URL().toString()`
  // normalises it to a trailing slash, which is exactly the computed canonical and the
  // sitemap <loc>, so it is correct — but no pilot site could exercise it.
  it("accepts a bare-origin canonical on the root path, emitting the trailing slash", () => {
    const bare = createSeo({
      siteUrl: "https://airventexpo.com",
      siteName: "AirVent",
      canonicalPolicy: "strict-same-origin",
    }).generateSEOMetadata;
    const md = bare({ canonicalURL: "https://airventexpo.com" } as never, "");
    expect(md.alternates.canonical).toBe("https://airventexpo.com/");
    expect(md.openGraph.url).toBe("https://airventexpo.com/");
    // Identical to what the page would have computed for itself, so the sitemap <loc>
    // and the canonical agree rather than differing by one character.
    expect(md.alternates.canonical).toBe(
      bare(null, "").alternates.canonical,
    );
    expect(logged).toEqual([]);
  });

  it("still rejects that same bare origin when a sub-path claims it", () => {
    const bare = createSeo({
      siteUrl: "https://airventexpo.com",
      siteName: "AirVent",
      canonicalPolicy: "strict-same-origin",
    }).generateSEOMetadata;
    // The normalising above must not smuggle a homepage canonical onto a real page: with
    // or without the trailing slash, the homepage guard has to catch it.
    for (const value of ["https://airventexpo.com", "https://airventexpo.com/"]) {
      expect(
        bare({ canonicalURL: value } as never, "about").alternates.canonical,
      ).toBe("https://airventexpo.com/about/");
    }
    expect(logged.filter((l) => l.includes("must not declare"))).toHaveLength(2);
  });

  it('rejects the "hhttps" typo', () => {
    expect(canonical("hhttps://expopharmtech.com/about/")).toBe(COMPUTED);
    expect(logged.join("\n")).toMatch(/unsupported protocol|malformed/);
  });

  it("rejects http on an https site and returns the COMPUTED url, never an upgraded string", () => {
    // The CMS value points somewhere else, so "fell back to the page's own URL" and
    // "silently rewrote http→https" are distinguishable. On a canonical that already
    // matches the page path the two are the same string and prove nothing.
    const got = canonical("http://expopharmtech.com/elsewhere/");
    expect(got).toBe(COMPUTED);
    expect(got).not.toBe("https://expopharmtech.com/elsewhere/");
    expect(logged.join("\n")).toContain("expected scheme https:");
  });

  it("rejects an off-site URL, including a Google Sheets link", () => {
    expect(canonical("https://docs.google.com/spreadsheets/d/abc/edit#gid=0")).toBe(COMPUTED);
    expect(canonical("https://example.com/x")).toBe(COMPUTED);
    expect(logged.filter((l) => l.includes("off-site"))).toHaveLength(2);
  });

  it("rejects free text and an email address", () => {
    expect(canonical("see the sheet")).toBe(COMPUTED);
    expect(canonical("seoteam@acronym.com")).toBe(COMPUTED);
    expect(canonical("/about")).toBe(COMPUTED);
    expect(logged.filter((l) => l.includes("malformed"))).toHaveLength(3);
  });

  it("rejects a blank value silently, and keeps the root-canonical guard", () => {
    expect(canonical("   ")).toBe(COMPUTED);
    expect(canonical(null)).toBe(COMPUTED);
    expect(logged).toEqual([]);
    expect(canonical("https://expopharmtech.com/")).toBe(COMPUTED);
    expect(logged.join("\n")).toContain("must not declare the homepage as its canonical");
  });

  it("still allows the root canonical on the root page itself", () => {
    expect(canonical("https://expopharmtech.com/", "")).toBe("https://expopharmtech.com/");
    expect(logged).toEqual([]);
  });

  it("passthrough (the default) does none of this", () => {
    const loose = createSeo(ITE).generateSEOMetadata;
    expect(loose({ canonicalURL: "http://expopharmtech.com/about/" }, "about").alternates.canonical).toBe("http://expopharmtech.com/about/");
    expect(loose({ canonicalURL: "see the sheet" }, "about").alternates.canonical).toBe("see the sheet");
    expect(logged).toEqual([]);
  });
});

describe('noIndexPolicy: "strict"', () => {
  const strict = createSeo({ ...ITE, noIndexPolicy: "strict" }).generateSEOMetadata;
  const loose = createSeo(ITE).generateSEOMetadata;

  it('the string "false" indexes under strict, and noindexes under the default', () => {
    expect(strict({ noIndex: "false" }, "a").robots.index).toBe(true);
    expect(loose({ noIndex: "false" }, "a").robots.index).toBe(false);
  });

  it('metaRobots "noindex, follow" keeps follow under strict, and is ignored by default', () => {
    expect(strict({ metaRobots: "noindex, follow" }, "a").robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
    expect(loose({ metaRobots: "noindex, follow" }, "a").robots.index).toBe(true);
  });

  it("agrees with the default on a real boolean, which is what every audited site stores", () => {
    for (const value of [true, false, null, undefined]) {
      expect(strict({ noIndex: value }, "a").robots).toEqual(loose({ noIndex: value }, "a").robots);
    }
  });

  it("noindex from a boolean still means nofollow", () => {
    expect(strict({ noIndex: true }, "a").robots).toEqual({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    });
  });

  it('"noindex, nofollow" and a bare "noindex" differ only in follow', () => {
    expect(strict({ metaRobots: "noindex, nofollow" }, "a").robots.follow).toBe(false);
    expect(strict({ robots: "NOINDEX" }, "a").robots.follow).toBe(true);
  });
});

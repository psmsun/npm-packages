import { describe, expect, it } from "vitest";
import * as legacyMitt from "./__fixtures__/legacy-seo-mitt.js";
import * as legacyPharmtech from "./__fixtures__/legacy-seo-pharmtech.js";
import { createSeo, summarise } from "./seo.js";

// Same values as __fixtures__/siteConfig.js, which the legacy copies import.
const site = {
  siteUrl: "https://site.test",
  siteTitle: "Site Title",
  siteDescription: "Site description.",
};
const { generateSEOMetadata } = createSeo(site);

const LONG = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");

type Case = [name: string, seo: any, path: any, page: any];

// Inputs on which the original and the upgraded seo.js agree.
const sharedCases: Case[] = [
  ["homepage, nothing", null, "", undefined],
  ["undefined everything", undefined, undefined, undefined],
  [
    "full CMS record, relative image, noIndex",
    {
      metaTitle: "T",
      metaDescription: "D",
      keywords: "a, b",
      canonicalURL: "https://site.test/other/",
      noIndex: true,
      metaImage: { url: "/uploads/i.jpg" },
    },
    "about",
    { PageName: "About" },
  ],
  ["absolute image", { metaImage: { url: "https://cdn.test/i.jpg" } }, "x", { Title: "X" }],
  ["empty image url", { metaImage: { url: "" } }, "x", { Title: "X" }],
  [
    "inherited root canonical ignored on non-root",
    { canonicalURL: "https://site.test" },
    "articles/foo",
    { Title: "Foo", Excerpt: "Short excerpt" },
  ],
  [
    "root canonical with slash ignored on non-root",
    { canonicalURL: "https://site.test/" },
    "/sectors/bar/",
    { Title: "Bar", ShortText: "Short text" },
  ],
  ["root canonical kept on root", { canonicalURL: "https://site.test/" }, "", undefined],
  ["messy path", null, "  //media-gallery/q//  ", { Title: "Q" }],
  ["truncation at a word boundary", undefined, "articles/baz", { Title: "Baz", Excerpt: LONG }],
  ["whitespace collapse", null, "p", { PageName: "P", ShortText: "  a \n\n b\t c  " }],
  ["blank excerpt falls to default", null, "p", { Title: "P", Excerpt: "   " }],
  ["ShortText used when Excerpt missing", null, "p", { Title: "P", ShortText: "st" }],
  ["noIndex false explicit", { noIndex: false }, "p", { Title: "P" }],
  ["keywords array", { keywords: ["a", "b"] }, "p", { Title: "P" }],
  ["Title beats PageName", null, "p", { Title: "T", PageName: "PN" }],
];

// Inputs where only the upgraded behaviour is defined (speakers, partners, HTML).
const upgradedOnlyCases: Case[] = [
  ["speaker: name leads, title appended, company", null, "speakers/jane", { Name: "Jane Doe", Title: "CTO", Company: "Acme" }],
  ["speaker: company equal to title is skipped", null, "speakers/jane", { Name: "Jane Doe", Title: "CTO", Company: "CTO" }],
  ["speaker: no company", null, "speakers/jane", { Name: "Jane Doe", Title: "CTO" }],
  ["partner: name only, content description", null, "partner/acme", { Name: "Acme", Content: "<p>Hello &amp; <b>welcome</b>&nbsp;all</p>" }],
  ["partner: long name capped at 60", null, "partner/long", { Name: `${"A".repeat(30)} ${"B".repeat(40)}` }],
  ["article: html excerpt stripped", null, "articles/h", { Title: "H", Excerpt: "<b>Bold</b>&nbsp;text &lt;tag&gt; &quot;q&quot; &#39;s&#39;" }],
  ["article: content used when excerpt empty", null, "articles/c", { Title: "C", Excerpt: "", Content: "<p>Body text</p>" }],
  ["CMS fields still win over person data", { metaTitle: "M", metaDescription: "MD" }, "speakers/x", { Name: "N", Title: "T", Company: "C" }],
];

describe("createSeo reproduces the legacy lib/seo.js", () => {
  it.each(sharedCases)("original (pharmtech) variant: %s", (_name, seo, path, page) => {
    expect(generateSEOMetadata(seo, path, page)).toStrictEqual(
      legacyPharmtech.generateSEOMetadata(seo, path, page),
    );
  });
  it.each([...sharedCases, ...upgradedOnlyCases])("upgraded (Mitt) variant: %s", (_name, seo, path, page) => {
    expect(generateSEOMetadata(seo, path, page)).toStrictEqual(
      legacyMitt.generateSEOMetadata(seo, path, page),
    );
  });
});

describe("config", () => {
  it("defaults the Open Graph locale to en_US and accepts an override", () => {
    expect(generateSEOMetadata(null, "").openGraph.locale).toBe("en_US");
    const ru = createSeo({ ...site, locale: "ru_RU" }).generateSEOMetadata(null, "");
    expect(ru.openGraph.locale).toBe("ru_RU");
  });
  it("strips a trailing slash from siteUrl", () => {
    const m = createSeo({ ...site, siteUrl: "https://site.test/" }).generateSEOMetadata(
      { metaImage: { url: "/i.jpg" } },
      "a",
    );
    expect(m.alternates.canonical).toBe("https://site.test/a/");
    expect(m.openGraph.images?.[0].url).toBe("https://site.test/i.jpg");
  });
  it("uses the site title and description when nothing else exists", () => {
    const m = generateSEOMetadata(null, "");
    expect(m.title.absolute).toBe("Site Title");
    expect(m.description).toBe("Site description.");
    expect(m.openGraph.siteName).toBe("Site Title");
    expect(m.alternates.canonical).toBe("https://site.test/");
  });
});

describe("summarise", () => {
  it("returns null for non-strings and blank strings", () => {
    expect(summarise(null)).toBeNull();
    expect(summarise(42)).toBeNull();
    expect(summarise("  \n ")).toBeNull();
  });
  it("strips tags, the six entities and collapses whitespace", () => {
    expect(summarise("<p>A &amp; B</p>\n<b>C</b>&nbsp;&lt;x&gt; &quot;q&quot; &#39;s&#39;")).toBe(
      `A & B C <x> "q" 's'`,
    );
  });
  it("truncates at the last space and appends an ellipsis", () => {
    const s = summarise(LONG, 30);
    expect(s).toBe("word0 word1 word2 word3 word4…");
    expect(s!.length).toBeLessThanOrEqual(31);
  });
  it("hard-cuts a single long token", () => {
    expect(summarise("a".repeat(50), 10)).toBe(`${"a".repeat(10)}…`);
  });
  it("returns short text untouched", () => {
    expect(summarise("short")).toBe("short");
  });
});

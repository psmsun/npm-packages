import { describe, expect, it } from "vitest";
import * as legacyMitt from "./__fixtures__/legacy-seo-mitt.js";
import * as legacyPharmtech from "./__fixtures__/legacy-seo-pharmtech.js";
import { cleanHeaderTitle, createSeo, summarise } from "./seo.js";

// Same values as __fixtures__/siteConfig.js, which the legacy copies import. The legacy
// SITE_TITLE is the new siteName, so a title falling back to the site is unchanged.
const site = {
  siteUrl: "https://site.test",
  siteName: "Site Title",
};
const { generateSEOMetadata } = createSeo(site);
const LEGACY_SITE_DESCRIPTION = "Site description.";

/**
 * v2 deliberately drops one thing the legacy did: the site-wide description fallback.
 * Where the legacy filled in SITE_DESCRIPTION, v2 emits no description at all. Strip
 * that from the legacy result so the parity suite keeps proving nothing ELSE changed.
 */
function withoutSiteDescriptionFallback(legacy: any) {
  if (legacy.description !== LEGACY_SITE_DESCRIPTION) return legacy;
  const { description: _d, ...rest } = legacy;
  const { description: _og, ...openGraph } = legacy.openGraph;
  const { description: _tw, ...twitter } = legacy.twitter;
  return { ...rest, openGraph, twitter };
}

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
      withoutSiteDescriptionFallback(legacyPharmtech.generateSEOMetadata(seo, path, page)),
    );
  });
  it.each([...sharedCases, ...upgradedOnlyCases])("upgraded (Mitt) variant: %s", (_name, seo, path, page) => {
    expect(generateSEOMetadata(seo, path, page)).toStrictEqual(
      withoutSiteDescriptionFallback(legacyMitt.generateSEOMetadata(seo, path, page)),
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
  it("uses the site name when nothing else exists, and no description at all", () => {
    const m = generateSEOMetadata(null, "");
    expect(m.title.absolute).toBe("Site Title");
    expect(m).not.toHaveProperty("description");
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

describe("Header fallbacks (v2)", () => {
  it("uses Header.Title when the page has no Title, and beats PageName", () => {
    const m = generateSEOMetadata(null, "p", {
      PageName: "Insights & Resources",
      Header: { Title: "Industry Insights // Hub" },
    });
    expect(m.title.absolute).toBe("Industry Insights Hub");
  });
  it("keeps Title ahead of Header.Title, and Header.Title ahead of PageName", () => {
    const page = { Title: "T", PageName: "PN", Header: { Title: "H" } };
    expect(generateSEOMetadata(null, "p", page).title.absolute).toBe("T");
    expect(
      generateSEOMetadata(null, "p", { PageName: "PN", Header: { Title: "H" } })
        .title.absolute,
    ).toBe("H");
    expect(
      generateSEOMetadata(null, "p", { PageName: "PN", Header: { Title: "  " } })
        .title.absolute,
    ).toBe("PN");
  });
  it("a CMS metaTitle still wins over Header.Title", () => {
    const m = generateSEOMetadata({ metaTitle: "M" }, "p", {
      Header: { Title: "H" },
    });
    expect(m.title.absolute).toBe("M");
  });
  it("uses Header.Content as the description when nothing earlier exists", () => {
    const m = generateSEOMetadata(null, "p", {
      PageName: "P",
      Header: { Content: "<p>An intro paragraph &amp; more.</p>" },
    });
    expect(m.description).toBe("An intro paragraph & more.");
    expect(m.openGraph.description).toBe("An intro paragraph & more.");
    expect(m.twitter.description).toBe("An intro paragraph & more.");
  });
  it("Excerpt, ShortText and Content all outrank Header.Content", () => {
    const header = { Content: "header" };
    const t = (page: any) => generateSEOMetadata(null, "p", page).description;
    expect(t({ Excerpt: "e", ShortText: "s", Content: "c", Header: header })).toBe("e");
    expect(t({ ShortText: "s", Content: "c", Header: header })).toBe("s");
    expect(t({ Content: "c", Header: header })).toBe("c");
    expect(t({ Header: header })).toBe("header");
  });
  it("a whitespace-only earlier source does not shadow Header.Content", () => {
    const m = generateSEOMetadata(null, "p", {
      Excerpt: "   ",
      ShortText: "\n",
      Header: { Content: "Real intro." },
    });
    expect(m.description).toBe("Real intro.");
  });
  it("whitespace-only Header.Content leaves the page with no description", () => {
    const m = generateSEOMetadata(null, "p", {
      PageName: "P",
      Header: { Title: "H", Content: " " },
    });
    expect(m).not.toHaveProperty("description");
    expect(m.openGraph).not.toHaveProperty("description");
    expect(m.twitter).not.toHaveProperty("description");
    expect(m.title.absolute).toBe("H");
  });
  it("a whitespace-only CMS metaTitle/metaDescription counts as absent", () => {
    const m = generateSEOMetadata({ metaTitle: " ", metaDescription: "  " }, "p", {
      PageName: "P",
      Header: { Content: "Intro." },
    });
    expect(m.title.absolute).toBe("P");
    expect(m.description).toBe("Intro.");
  });
  it("ignores Header.Text, whose MainTitle is a boolean flag, not a title", () => {
    // mosbuild-regional's Header.Text is an array of { Title, MainTitle: boolean }.
    const m = generateSEOMetadata(null, "p", {
      PageName: "P",
      Header: {
        Title: "Real heading",
        Text: [
          { Title: "Part one", MainTitle: true },
          { Title: "Part two", MainTitle: false },
        ],
      },
    });
    expect(m.title.absolute).toBe("Real heading");
    expect(m).not.toHaveProperty("description");
  });
  it("a speaker title never consults Header.Title", () => {
    const m = generateSEOMetadata(null, "speakers/jane", {
      Name: "Jane Doe",
      Title: "CTO",
      Company: "Acme",
      Header: { Title: "Speakers // 2026" },
    });
    expect(m.title.absolute).toBe("Jane Doe — CTO");
    expect(m.description).toBe("Jane Doe — CTO, Acme");
  });
  it("Header.Content outranks the person summary, as the chain is ordered", () => {
    // Speaker and partner queries select no Header, so this only bites if one ever does.
    const m = generateSEOMetadata(null, "speakers/jane", {
      Name: "Jane Doe",
      Title: "CTO",
      Company: "Acme",
      Header: { Content: "All our speakers." },
    });
    expect(m.description).toBe("All our speakers.");
  });
});

describe("cleanHeaderTitle", () => {
  it("strips a separating // and collapses the gap", () => {
    expect(cleanHeaderTitle("Industry Insights // Hub")).toBe("Industry Insights Hub");
    expect(cleanHeaderTitle("Why//exhibit")).toBe("Why exhibit");
  });
  it("keeps the // of a URL, which is preceded by a colon", () => {
    expect(cleanHeaderTitle("Visit https://expopharmtech.com now")).toBe(
      "Visit https://expopharmtech.com now",
    );
    expect(cleanHeaderTitle("A // https://x.test")).toBe("A https://x.test");
  });
  it("removes the space a cut leaves in front of punctuation", () => {
    expect(cleanHeaderTitle("Why exhibit // ?")).toBe("Why exhibit?");
    expect(cleanHeaderTitle("Book now // !")).toBe("Book now!");
    expect(cleanHeaderTitle("Visit // , then leave")).toBe("Visit, then leave");
  });
  it("collapses newlines and returns null for nothing usable", () => {
    expect(cleanHeaderTitle("Two\n\nlines")).toBe("Two lines");
    expect(cleanHeaderTitle("  ")).toBeNull();
    expect(cleanHeaderTitle("//")).toBeNull();
    expect(cleanHeaderTitle(null)).toBeNull();
    expect(cleanHeaderTitle(42)).toBeNull();
    expect(cleanHeaderTitle(["Part one"])).toBeNull();
  });
});

describe("summarise strips embedded style and script blocks", () => {
  it("drops a <style> block with its inner CSS", () => {
    const content =
      '<div><style>@import url(https://fonts.bunny.net/css?family=roboto);' +
      "#_form_182_{font-size:14px;color:#333}</style><p>Register for the show.</p></div>";
    expect(summarise(content)).toBe("Register for the show.");
  });
  it("drops a <script> block with its inner JS", () => {
    expect(
      summarise('<p>Hello</p><script type="text/javascript">var a = 1 < 2;</script>'),
    ).toBe("Hello");
  });
  it("leaves a page with nothing but a form with no description", () => {
    expect(summarise("<style>#_form_182_{color:#333}</style>")).toBeNull();
  });
});
